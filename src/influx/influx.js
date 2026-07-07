const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || 'mysecretinfluxadmintoken';
const org = process.env.INFLUX_ORG || 'myorg';
const bucket = process.env.INFLUX_BUCKET || 'flowbucket';

const client = new InfluxDB({ url, token });
const writeApi = client.getWriteApi(org, bucket, 'ns');
const queryApi = client.getQueryApi(org);

async function writeTelemetry(deviceId, flow, total_flow, minValue, maxValue, overflowCount, timestamp) {
  try {
    const point = new Point('device_flow')
      .tag('deviceId', deviceId)
      .floatField('flow', flow)
      .floatField('total_flow', total_flow)
      .floatField('minValue', minValue)
      .floatField('maxValue', maxValue)
      .intField('overflowCount', overflowCount);

    if (timestamp) {
      const parsedTime = new Date(timestamp);
      if (!isNaN(parsedTime.getTime())) {
        point.timestamp(parsedTime);
      }
    }

    writeApi.writePoint(point);
    await writeApi.flush();
  } catch (error) {
    console.error(`[InfluxDB Error] Writing telemetry failed:`, error);
  }
}

async function getBaseTotalizers(deviceId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

  const queries = {
    today: `from(bucket: "${bucket}") |> range(start: ${startOfToday}) |> filter(fn: (r) => r["_measurement"] == "device_flow" and r["deviceId"] == "${deviceId}" and r["_field"] == "total_flow") |> first()`,
    month: `from(bucket: "${bucket}") |> range(start: ${startOfMonth}) |> filter(fn: (r) => r["_measurement"] == "device_flow" and r["deviceId"] == "${deviceId}" and r["_field"] == "total_flow") |> first()`,
    year: `from(bucket: "${bucket}") |> range(start: ${startOfYear}) |> filter(fn: (r) => r["_measurement"] == "device_flow" and r["deviceId"] == "${deviceId}" and r["_field"] == "total_flow") |> first()`
  };

  const getFirstVal = (query) => {
    return new Promise((resolve) => {
      let val = null;
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          val = o._value;
        },
        error() {
          resolve(null);
        },
        complete() {
          resolve(val);
        }
      });
    });
  };

  const [todayVal, monthVal, yearVal] = await Promise.all([
    getFirstVal(queries.today),
    getFirstVal(queries.month),
    getFirstVal(queries.year)
  ]);

  return {
    today_base: todayVal !== null ? parseFloat(todayVal) : null,
    month_base: monthVal !== null ? parseFloat(monthVal) : null,
    year_base: yearVal !== null ? parseFloat(yearVal) : null,
  };
}

async function queryTelemetry(deviceId, fromDate, toDate, interval) {
  let start = '1970-01-01T00:00:00Z';
  let stop = new Date().toISOString();
  try {
    if (fromDate && !isNaN(Date.parse(fromDate))) {
      start = new Date(fromDate).toISOString();
    }
    if (toDate && !isNaN(Date.parse(toDate))) {
      stop = new Date(toDate).toISOString();
    }
  } catch (error) {
    console.error(`[InfluxDB Query] Date parsing failed for values fromDate=${fromDate}, toDate=${toDate}:`, error);
  }

  let aggregation = '';
  if (interval && !isNaN(parseInt(interval)) && parseInt(interval) > 0) {
    aggregation = `|> aggregateWindow(every: ${parseInt(interval)}s, fn: mean, createEmpty: false)`;
  }

  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r["_measurement"] == "device_flow")
      |> filter(fn: (r) => r["deviceId"] == "${deviceId}")
      ${aggregation}
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: false)
  `;

  return new Promise((resolve, reject) => {
    const rows = [];
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        rows.push({
          time: o._time,
          deviceId: o.deviceId,
          flow: o.flow !== undefined ? o.flow : 0,
          total_flow: o.total_flow !== undefined ? o.total_flow : 0,
          minValue: o.minValue !== undefined ? o.minValue : 0,
          maxValue: o.maxValue !== undefined ? o.maxValue : 0,
          overflowCount: o.overflowCount !== undefined ? o.overflowCount : 0,
        });
      },
      error(err) {
        console.error(`[InfluxDB Query Error]`, err);
        reject(err);
      },
      complete() {
        resolve(rows);
      },
    });
  });
}

async function queryLatestTelemetry(allowedDeviceIds, isAdmin) {
  let deviceFilter = '';
  if (!isAdmin) {
    if (allowedDeviceIds.length === 0) {
      return [];
    }
    const filterConditions = allowedDeviceIds.map(id => `r["deviceId"] == "${id}"`).join(' or ');
    deviceFilter = `|> filter(fn: (r) => ${filterConditions})`;
  }

  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "device_flow")
      ${deviceFilter}
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  const rawData = await new Promise((resolve, reject) => {
    const rows = [];
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        rows.push({
          time: o._time,
          deviceId: o.deviceId,
          flow: o.flow !== undefined ? o.flow : 0,
          total_flow: o.total_flow !== undefined ? o.total_flow : 0,
          minValue: o.minValue !== undefined ? o.minValue : 0,
          maxValue: o.maxValue !== undefined ? o.maxValue : 0,
          overflowCount: o.overflowCount !== undefined ? o.overflowCount : 0,
        });
      },
      error(err) {
        console.error(`[InfluxDB Latest Query Error]`, err);
        reject(err);
      },
      complete() {
        resolve(rows);
      },
    });
  });

  // Enrich with daily, monthly, yearly flow calculations using base totalizers
  const enriched = await Promise.all(rawData.map(async (item) => {
    const bases = await getBaseTotalizers(item.deviceId);
    
    const today_base = bases.today_base !== null ? bases.today_base : item.total_flow;
    const month_base = bases.month_base !== null ? bases.month_base : item.total_flow;
    const year_base = bases.year_base !== null ? bases.year_base : item.total_flow;

    return {
      ...item,
      today_base,
      month_base,
      year_base,
      daily_flow: Math.max(0, item.total_flow - today_base),
      monthly_flow: Math.max(0, item.total_flow - month_base),
      yearly_flow: Math.max(0, item.total_flow - year_base),
    };
  }));

  return enriched;
}

module.exports = {
  writeTelemetry,
  queryTelemetry,
  queryLatestTelemetry,
};
