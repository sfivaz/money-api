const Proxy = require('./Proxy');
const db = require('../database');
const moment = require("moment");
const Account = db.Account;
const Category = db.Category;
const Transaction = db.Transaction;

class TransactionProxy extends Proxy {

    constructor() {
        super();
        this.model = Transaction;
    }

    findFull() {
        return this.model
            .findAll({
                include: [
                    {
                        model: Account,
                        as: 'sourceAccount'
                    },
                    {
                        model: Account,
                        as: 'destinationAccount'
                    },
                    Category
                ]
            });
    }

    findOneFull(id) {
        return this.model
            .findByPk(id, {
                include: [
                    {
                        model: Account,
                        as: 'sourceAccount'
                    },
                    {
                        model: Account,
                        as: 'destinationAccount'
                    },
                    Category
                ]
            });
    }

    findFrom(accountId) {
        const Op = db.Sequelize.Op;
        return this.model
            .findAll({
                where: {
                    [Op.or]: [
                        {sourceAccountId: accountId},
                        {
                            [Op.and]: [
                                {destinationAccountId: accountId},
                                {type: "transfer"}
                            ]
                        },
                    ]
                }
            });
    }

    findMonthly() {
        return this.model.findAll({where: {isMonthly: 1}});
    }

    update(transaction, id) {
        return this.model
            .update(transaction, {where: {id}})
            .then(() => this.findOneFull(id));
    }

    create(transaction) {
        return this.model
            .create(transaction)
            .then(transaction => this.findOneFull(transaction.id));
    }

    findIn(transaction, date) {
        const Sequelize = db.Sequelize;
        const Op = Sequelize.Op;

        const dayBefore = moment(date).subtract(1, 'days').clone();
        const dayAfter = moment(date).add(1, 'days').clone();

        return this.model.findAll({
            where: {
                description: transaction.description,
                type: transaction.type,
                value: transaction.value,
                date: {
                    [Op.lt]: dayAfter.toDate(),
                    [Op.gt]: dayBefore.toDate()
                },
                sourceAccountId: transaction.sourceAccountId,
                destinationAccountId: transaction.destinationAccountId,
                categoryId: transaction.categoryId
            }
        });
    }
}

module.exports = TransactionProxy;