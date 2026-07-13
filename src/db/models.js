const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user', // 'admin' | 'user'
  },
}, {
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
  }
});

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  site: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'active', // 'active' | 'inactive'
  }
});

const UserDevice = sequelize.define('UserDevice', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  DeviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: Device,
      key: 'id'
    }
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['UserId', 'DeviceId']
    }
  ]
});

User.belongsToMany(Device, { through: UserDevice, onDelete: 'CASCADE' });
Device.belongsToMany(User, { through: UserDevice, onDelete: 'CASCADE' });

UserDevice.belongsTo(User, { foreignKey: 'UserId', onDelete: 'CASCADE' });
UserDevice.belongsTo(Device, { foreignKey: 'DeviceId', onDelete: 'CASCADE' });
User.hasMany(UserDevice, { foreignKey: 'UserId', onDelete: 'CASCADE' });
Device.hasMany(UserDevice, { foreignKey: 'DeviceId', onDelete: 'CASCADE' });

const AlertRule = sequelize.define('AlertRule', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: Device,
      key: 'id'
    }
  },
  operator: {
    type: DataTypes.STRING, // '>', '<', '<=', '>=', '='
    allowNull: false,
  },
  value: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  severity: {
    type: DataTypes.STRING, // 'info' | 'warning' | 'critical'
    allowNull: false,
    defaultValue: 'warning',
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cooldownMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15,
  },
  lastTriggeredAt: {
    type: DataTypes.DATE,
    allowNull: true,
  }
});

const AlertLog = sequelize.define('AlertLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: Device,
      key: 'id'
    }
  },
  severity: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
});

Device.hasMany(AlertRule, { foreignKey: 'deviceId', onDelete: 'CASCADE' });
AlertRule.belongsTo(Device, { foreignKey: 'deviceId', onDelete: 'CASCADE' });

Device.hasMany(AlertLog, { foreignKey: 'deviceId', onDelete: 'CASCADE' });
AlertLog.belongsTo(Device, { foreignKey: 'deviceId', onDelete: 'CASCADE' });

const EmailRecipient = sequelize.define('EmailRecipient', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.STRING, // 'active' | 'inactive'
    allowNull: false,
    defaultValue: 'active',
  },
  effectiveStatus: {
    type: DataTypes.STRING, // 'active' | 'inactive' | 'none'
    allowNull: false,
    defaultValue: 'none',
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }
});

module.exports = {
  sequelize,
  User,
  Device,
  UserDevice,
  AlertRule,
  AlertLog,
  EmailRecipient
};
