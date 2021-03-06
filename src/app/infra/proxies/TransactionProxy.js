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

    findAllFull() {
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
        //TODO check with true
        return this.model.findAll({where: {isMonthly: 1}});
    }

    update(transaction, id) {
        if (transaction.isMonthly) {
            const dates = this.getRemainingMonths(transaction.date);
            if (dates.length) {
                return this.updateMonthly(transaction, id, dates)
                    .then(rows => {
                        rows[0].id = id;
                        return rows.map(row => row.id);
                    })
                    .then(ids => this.findFull(ids));
            }
        }
        return this.model
            .update(transaction, {where: {id}})
            .then(() => this.findOneFull(id))
            .then(transaction => [transaction]);
    }

    create(transaction) {
        if (transaction.isMonthly) {
            const dates = this.getRemainingMonths(transaction.date);
            if (dates.length) {
                return this.createMonthly(transaction, dates)
                    .then(transactions => transactions.map(transaction => transaction.id))
                    .then(ids => this.findFull(ids));
            }
        }
        return this.model.create(transaction)
            .then(transaction => this.findOneFull(transaction.id))
            .then(transaction => [transaction]);
    }

    createMonthly(transaction, dates) {
        if (dates.length === 1)
            return this.createAndCloneOnce(transaction, dates[0]);
        else
            return this.createAndCloneManyTimes(transaction, dates);
    }

    updateMonthly(transaction, id, dates) {
        if (dates.length === 1)
            return this.updateAndCloneOnce(transaction, id, dates[0]);
        else
            return this.updateAndCloneManyTimes(transaction, id, dates);
    }

    updateAndCloneOnce(transaction, id, date) {
        transaction.isMonthly = false;
        const firstStep = this.model.update(transaction, {where: {id}});
        const secondStep = this.createMonthlyIn(transaction, date);
        return Promise.all([firstStep, secondStep]);
    }

    updateAndCloneManyTimes(transaction, id, dates) {
        transaction.isMonthly = false;
        const firstStep = this.model.update(transaction, {where: {id}});
        const otherSteps = dates.map((date, index) => {
            if (index < dates.length - 1)
                return this.createIn(transaction, date);
            else
                return this.createMonthlyIn(transaction, date);
        });
        return Promise.all([firstStep, ...otherSteps]);
    }

    createAndCloneOnce(transaction, date) {
        transaction.isMonthly = false;
        const firstStep = this.model.create(transaction);
        const secondStep = this.createMonthlyIn(transaction, date);
        return Promise.all([firstStep, secondStep]);
    }

    createAndCloneManyTimes(transaction, dates) {
        transaction.isMonthly = false;
        const firstStep = this.model.create(transaction);
        const otherSteps = dates.map((date, index) => {
            if (index < dates.length - 1)
                return this.createIn(transaction, date);
            else
                return this.createMonthlyIn(transaction, date);
        });
        return Promise.all([firstStep, ...otherSteps]);
    }

    findFull(ids) {
        const Op = db.Sequelize.Op;
        return this.model
            .findAll({
                    where: {
                        id: {
                            [Op.or]: ids
                        }
                    },
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
                }
            );
    }

    setNonMonthly(transaction) {
        const transactionRaw = transaction.get({plain: true});
        transactionRaw.isMonthly = false;
        return this.model.update(transactionRaw, {where: {id: transactionRaw.id}});
    }

    createMonthlyIn(transaction, date) {
        transaction.isMonthly = true;
        return this.createIn(transaction, date);
    }

    createIn(transaction, date) {
        delete transaction.id;
        transaction.date = date;
        return this.model.create(transaction);
    }

    getRemainingMonths(date) {
        const transactionDate = moment(date);
        const today = moment();
        const nbOfMonths = today.diff(transactionDate, 'months');
        const dates = [];
        let i = 0;
        while (i < nbOfMonths) {
            transactionDate.add(1, 'months');
            dates.push(transactionDate.clone().toDate());
            i++;
        }
        return dates;
    }
}

module.exports = TransactionProxy;