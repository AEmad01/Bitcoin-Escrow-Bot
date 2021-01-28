const { DataTypes, Model } = require("sequelize");

module.exports = class escrow extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        buyerID: { type: DataTypes.BIGINT },
        sellerID: { type: DataTypes.BIGINT },
        amount: { type: DataTypes.DOUBLE },
        status: { type: DataTypes.INTEGER },
        amountFee: {type: DataTypes.DOUBLE,            defaultValue: '0'
      },
        channelid: { type: DataTypes.BIGINT },
        terms: { type: DataTypes.STRING },

        txID: { type: DataTypes.STRING },
        confirmations: { type: DataTypes.INTEGER },
        address: { type: DataTypes.STRING },
        buyerStatus: { type: DataTypes.BOOLEAN },
        sellerStatus: { type: DataTypes.BOOLEAN },
        amountDeposited: {type: DataTypes.DOUBLE},
        used: { type: DataTypes.BOOLEAN }
      },
      {
        tableName: "escrow",
        timestamps: true,

        sequelize
      }
    );
  }
};
//