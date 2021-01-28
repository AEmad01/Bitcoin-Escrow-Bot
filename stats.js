const { DataTypes, Model } = require("sequelize");

module.exports = class stats extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        
        btcProfit: { type: DataTypes.DOUBLE },
        btcTraded: { type: DataTypes.DOUBLE },
        transactions: { type: DataTypes.INTEGER },
        gapAddress: { type: DataTypes.STRING },
        payout: {type: DataTypes.STRING},
        balance: { type: DataTypes.DOUBLE },
        globalProfit: { type: DataTypes.DOUBLE },
        feeThreshhold: { type: DataTypes.DOUBLE }
      },
      {
        tableName: "stats",
        timestamps: true,

        sequelize
      }
    );
  }
};
//