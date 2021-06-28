// Import the required modules
var Discord = require('discord.js');
var Http = require('http');
var db = require('./database.js');
var Ticket = require("./escrow.js");
var Stat = require("./stats.js");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var fee = 0.03; //todb
var check = 0;
var request = require("request");
var secondpw = "";
// Import configuration file
var config = require('./config.json');
var guid = 'guid'
";
var password = "pw";
var baseURL = 'url';
var passwordURL = "?password=@password"
var freeThreshhold = 0.0048; //todb
var key = "key"; //todb
var pub = "pub"; //todb
var disputeParent = 677138358874406973;
var closedParent = 677138487320903700;
var leva;
//transcript
const fs = require('fs').promises;
const jsdom = require('jsdom');
const {
    JSDOM
} = jsdom;
const dom = new JSDOM();
const document = dom.window.document;
// Json Object of all ticket types
var ticketTypes = config.ticketTypes;
var globalAddress;
// Create an instance of a Discord bot.
var bot = new Discord.Client();

function fixGap() {
    //todo: insert every 15th address generated in db and send $0.5 
    var getAddress = new XMLHttpRequest();
    var url = "https://api.blockchain.info/v2/receive/checkgap?xpub=" + pub + "&key=" + key;

    getAddress.open("GET", url);
    getAddress.send();
    getAddress.onreadystatechange = async (e) => {
        if (getAddress.readyState == 4 && getTX.status == 200) {

            var addressResponse = getAddress.responseText;
            console.log(addressResponse);
            var addressJson = JSON.parse(addressResponse);
            var addressFound = await addressJson["gap"];

            if (gap >= 15) { //fix gap need to send btc to some address...
                var fixG = new XMLHttpRequest();

                var url = baseURL + "payment&password=@password" + "&to=" + unusedLatest + "&amount=0.0000546";
                fixG.open("POST", url);
                fixG.send();

            }


        }
    }
}
var welcomeMessageId = -1;

function printResponse(err, data) {
    if (err != null) {
        console.log(err);
    } else {
        console.log(data);
    }
}
bot.on('ready', () => {
    //fire up the db
    db.authenticate()
        .then(() => {
            Ticket.init(db);
            Ticket.sync();
            Stat.init(db);
            Stat.sync();
            console.log("Database Loaded ");

        })
        .catch(err => console.log(err));
    //assign user as the admin
    bot.fetchUser("119893447846002690", false).then(user => {
        leva = user;
    })

    validateConfiguration();
    validateSupportChannel();
    registerReactionEvents();
    console.log('Escrow Bot is ready for action!')
});

bot.login(config.token);

async function updateStats(channel) {
    //print trade status
    var trade = await Ticket.findOne({
        where: {
            channelid: channel.id
        }
    });
    var stat = await Stat.findOne({
        where: {
            id: 1
        }
    });

    await Stat.update({
        btcProfit: stat.btcProfit + trade.amountFee - trade.amount,
        btcTraded: stat.btcTraded + trade.amount,
        globalProfit: stat.globalProfit + trade.amountFee - trade.amount,
        transactions: stat.transactions + 1
    }, {
        where: {
            id: 1
        }
    });
    //transfer to admin waLLET EVERY 0.002 BTC
    if (stat.btcProfit > 0.0020) {
        releaseAdmin(stat.btcProfit, stat.payout);
        await Stat.update({
            btcProfit: 0
        }, {
            where: {
                id: 1
            }
        });
        console.log("Admin Payout");
    }
}
//move profit to wallet
async function moveProfit() {
    var stat = await Ticket.findOne({
        where: {
            id: 1
        }
    });
    //fee as 10% of the amount
    var profit = stat.btcProfit * 0.9;
    if (profit > 20) {
        releaseTo(stat.payout, 123);
        await Stat.update({
            btcProfit: 0
        }, {
            where: {
                id: 1
            }
        });
    }


}

//create new wallet with the given label
async function createWallet(label) {
    var checkWallet = await Ticket.findOne({
        where: {
            channelid: label.id
        }
    });
    if (checkWallet.address != null) {
        sendTotalEmbed(label);
        return;
    }
    var getAddress = new XMLHttpRequest();
    
    var url = "https://api.blockchain.info/v2/receive?xpub=" + pub + "&callback=https%3A%2F%2Fwww.google.com%2F&key=" + key;
    getAddress.open("GET", url);
    getAddress.send();
    getAddress.onreadystatechange = async (e) => {
        //create escrow wallet and await resposne from blockchain api
        if (getAddress.readyState == 4 && getAddress.status == 200) {
            var addressResponse = getAddress.responseText;
            var addressJson = JSON.parse(addressResponse);
            var addressFound = await addressJson["address"];
            await Ticket.update({
                address: addressFound
            }, {
                where: {
                    channelid: label.id
                }
            });
            sendTotalEmbed(label);
            //check every 2 mins
            check = setInterval(checkRec, 2 * 60 * 1000, label);
        }

    }
}

function validateSupportChannel() {
    var channel = getSupportChannel();
    // Send welcome message if one isn't already on channel.
    channel.fetchMessages({
        limit: 1
    }).then(messages => {
        var lastMessage = messages.first();
        if (!lastMessage || !lastMessage.author.bot) {
            sendSupportWelcomeMessage();
        } else {
            welcomeMessageId = lastMessage.id;
        }
    }).catch(console.error);

    // Don't allow persistent user reactions on welcome message.
    bot.on('messageReactionAdd', (reaction, user) => {
        var message = reaction.message;
        if (!user.bot && message.id == welcomeMessageId) {
            reaction.remove(user);
        }
    });
}

//validate config
function validateConfiguration() {
    if (getSupportChannel() == null) {
        throw new Error("Could not locate Support Channel with ID: " + config.supportChannelId);
    }
}
//get support channel id
function getSupportChannel() {
    return bot.channels.get(config.supportChannelId);
}

//generate status message
function textStatus(status) {
    switch (status) {
        case 0:
            return "Please add a Seller";
            break;
        case 1:
            return "Waiting both users to accept the terms and amount";
            break;
        case 2:
            return "Waiting Escrow Funds";
            break;
        case 3:
            return "Waiting Blockchain Confirmations\n\n *The status will refresh automatically.*";
            break;
        case 4:
            return "Transaction Confirmed";
            break;
        case 5:
            return "Dispute Open";
            break;
        case 6:
            return "Dispute Closed";
            break;
        case 7:
            return "Transaction Completed";
            break;
        case 9:
            return "Partially Funded";
            break;
        case 10:
            return "Refunded/Cancelled";
    }
}
//listens to user reactions on the embed
async function userAction(userid, channel, action) {
    var user = 0;
    
    var SelectedTicket = await Ticket.findOne({
        where: {
            channelid: channel.id
        }
    });
    //trade must have terms stated
    if (SelectedTicket.terms == null) {
        channel.send("Please state the terms first.");
        return;
    }
    
    if (SelectedTicket.buyerID == userid)
        user = 1;

    if (user == 1) {
        await Ticket.update({
            buyerStatus: action
        }, {
            where: {
                channelid: channel.id
            }
        });


    } else {
        await Ticket.update({
            sellerStatus: action
        }, {
            where: {
                channelid: channel.id
            }
        });

    }
    //await both parties to accept terms
    if (action == 1) {
        if (SelectedTicket.status >= 2) {
            channel.send("You have already accepted the terms.")
            return;
        }
         //send notification
        channel.send("<@" + userid + "> accepted the terms.");


    } else {
        //send rejection
        channel.send("<@" + userid + "> rejected the terms.");
        if (SelectedTicket.status == 1) {
            resetTrade(channel);
            channel.send("Trade modified after escrow opened!\n The trade has been reset for security reasons.");
        }
        await Ticket.update({
            status: '1'
        }, {
            where: {
                channelid: channel.id
            }
        });

    }
    await checkBoth(channel);

}
//default trade values
async function resetTrade(channel) {
    await Ticket.update({
        status: '1',
        buyerStatus: 0,
        terms: null,
        amount: 0,
        sellerStatus: 0,
        address: null,
        amountFee: 0
    }, {
        where: {
            channelid: channel.id
        }
    });
    sendTotalEmbed(channel);

}
async function checkBoth(channel) {
    var SelectedTicket = await Ticket.findOne({
        where: {
            channelid: channel.id
        }
    });

    if (SelectedTicket.buyerStatus == 1 && SelectedTicket.sellerStatus == 1) {

        await Ticket.update({
            status: '2'
        }, {
            where: {
                channelid: channel.id
            }
        });
        channel.send("Creating Escrow Wallet, please wait...");

        try {
            await createWallet(channel);
        } catch (e) {
            channel.send("Error code 2");
        }

    }
}
//sends embed status
async function sendStatusEmbed(channel) {

    var SelectedTicket = await Ticket.findOne({
        where: {
            channelid: channel.id
        }
    });

    if (SelectedTicket.status != 2) {
        return;
    }

    if (SelectedTicket.status == 2) {
        var statusEmbed2 = new Discord.RichEmbed().setDescription(config.tradeStatusMessage.replace("Status: %status%", "Please send **" + SelectedTicket.amountFee + "** BTC **exactly** to **" + SelectedTicket.address + "**")).setFooter("This amount *includes* the escrow fee.\nPlease double check the address before sending.\nPlease **ONLY** send to this address.").setColor("#df79ff");
        channel.send(statusEmbed2);
    }
}
//welcome message
function sendSupportWelcomeMessage() {
    var supportChannel = bot.channels.get(config.supportChannelId);
    var welcomeMessage = config.welcomeMessageContents + "\n\n";
    Object.keys(ticketTypes).forEach(ticketType => {
        var section = ticketTypes[ticketType];
        welcomeMessage = welcomeMessage + section.reaction + " " + section.reactionDescription + "\n\n";
    });

    var embeddedMessage = new Discord.RichEmbed()
        .setDescription(welcomeMessage).setTitle("Welcome to Levathian's Escrow Server!")

    supportChannel.send(embeddedMessage)
        .then(sentMessage => {
            welcomeMessageId = sentMessage.id
            Object.keys(ticketTypes).forEach(ticketType => {
                var section = ticketTypes[ticketType];
                sentMessage.react(section.reaction);
            });

        }).catch(console.error);
    console.log("Sent welcome message to escrow channel!");
}
async function checkRec(channel) {
    console.log("Checking" + channel);
    var trade = await Ticket.findOne({
        where: {
            channelid: channel.id
        }
    });
//check if user sent amount to escrow
    if (trade.status == 2 || trade.status == 9) {
        var getTX = new XMLHttpRequest();
        var url = "https://blockchain.info/q/addressbalance/" + trade.address + "?confirmations=0"; //check if funded
        console.log(url);
        getTX.open("GET", url);
        getTX.send();
        getTX.onreadystatechange = async (e) => {
            if (getTX.readyState == 4 && getTX.status == 200) {
                var txResponse = getTX.responseText;
                var txBTC = txResponse / 100000000.0;
                if (txBTC > 0.0 && txBTC < trade.amountFee) {
                    //Partially Funded trade
                    console.log("Partially Funded");
                    await Ticket.update({
                        status: 9,
                        amountDeposited: txBTC,
                        used: 1
                    }, {
                        where: {
                            channelid: channel.id
                        }
                    });
                    sendTotalEmbed(channel);

                }
                if (txBTC >= trade.amountFee) { //Awaiting confirmations from blockchain api
                    gapcount = 0;
                    console.log("Awaiting Confirmations");
                    await Ticket.update({
                        status: 3,
                        amountDeposited: txBTC,
                        confirmations: 0,
                        used: 1
                    }, {
                        where: {
                            channelid: channel.id
                        }
                    });
                    sendTotalEmbed(channel);
                }

            }
        }
    }
    if (trade.confirmations == 0) {
        var getTX = new XMLHttpRequest();
        var url = "https://blockchain.info/q/addressbalance/" + trade.address + "?confirmations=1";
        console.log(url);
        getTX.open("GET", url);
        getTX.send();
        getTX.onreadystatechange = async (e) => {
            if (getTX.readyState == 4 && getTX.status == 200) {
                var txResponse = getTX.responseText;
                var txBTC = txResponse / 100000000.0;
                if (txBTC >= trade.amountFee) { //Confirmed
                    await Ticket.update({
                        status: 4,
                        amountDeposited: txBTC,
                        confirmations: 1
                    }, {
                        where: {
                            channelid: channel.id
                        }
                    });
                    sendTotalEmbed(channel);
                    clearInterval(check);

                }

            }
        }
    }
}
async function clean(channel) {
    channel.delete();
}
//admin release over ride function
async function releaseAdmin(amount, btc) {
    var releaseAddress = new XMLHttpRequest();

    var statchannel = bot.channels.get('676899977108127780');
    channel = statchannel;

    var stat = await Ticket.findOne({
        where: {
            id: 1
        }
    });
    var amount = amount * 100000000;
    var adminFee = 10000;
    var url = baseURL + "payment" + passwordURL + "&to=" + btc + "&amount=" + amount + "&from=0&fee=" + adminFee;



    releaseAddress.open("POST", url);
    releaseAddress.send();
    console.log(url);

    releaseAddress.onreadystatechange = async (e) => {
        if (releaseAddress.readyState == 4 && releaseAddress.status == 200) {

            var releaseResponse = releaseAddress.responseText;
            console.log(releaseResponse);
            var releaseJson = JSON.parse(releaseResponse);
            try {
                var release = await releaseJson["success"];
                var txid = await releaseJson['txid'];
                leva.send(`https://www.blockchain.com/btc/tx/ + ${txid}`);

            } catch (e) {
                console.log(releaseResponse);
                channel.send("Error code 1");
                //notify admin of a support request
                statchannel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.");

            }



        }
    }
}
//releases bitcoin to a given wallet from a given channel's trade wallet
async function releaseTo(btc, channel) {
    var releaseAddress = new XMLHttpRequest();

    if (channel == 123) { //admin payout
        var statchannel = bot.channels.get('676899977108127780');
        channel = statchannel;

        var stat = await Ticket.findOne({
            where: {
                id: 1
            }
        });
        var amount = stat.btcProfit * 100000000;
        var adminFee = 10000;
        var url = baseURL + "payment" + passwordURL + "&to=" + btc + "&amount=" + amount + "&from=0&fee=" + adminFee;

    } else {

        //customer payout
        var trade = await Ticket.findOne({
            where: {
                channelid: channel.id
            }
        });
        if (trade.txid) {
            console.log("defended double send");
            return;
        }
        //reasonable trade fee calulation
        var txfee = Math.round(Math.min((trade.amount * 100000000) * 0.028, 22000));
        console.log("Fee calculated by kappa equation is:" + txfee);
        if (txfee < 2900) {
            txfee = 2900;
        }
        var url = baseURL + "payment" + passwordURL + "&to=" + btc + "&amount=" + Math.round((trade.amount * 100000000) - txfee) + "&from=0&fee=" + txfee;
    }
    //send request to api
    releaseAddress.open("POST", url);
    releaseAddress.send();
    console.log(url);

    //when the request is sent
    releaseAddress.onreadystatechange = async (e) => {
        if (releaseAddress.readyState == 4 && releaseAddress.status == 200) {

            var releaseResponse = releaseAddress.responseText;
            console.log(releaseResponse);
            var releaseJson = JSON.parse(releaseResponse);
            try {
                //notify trade of address url
                var release = await releaseJson["success"];
                var txid = await releaseJson['txid'];
                if (channel != 123) {
                    channel.send(" <@" + trade.sellerID + "> https://www.blockchain.com/btc/tx/" + txid);
                    await Ticket.update({
                        txID: txid
                    }, {
                        where: {
                            channelid: channel.id
                        }
                    });

                    sendTotalEmbed(channel);
                } else {
                    channel.send("https://www.blockchain.com/btc/tx/" + txid);

                }
            } catch (e) {
                console.log(releaseResponse);
                channel.send("Error code 1");
                message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.");

            }



        }
    }
}
async function sendTotalEmbed(channel) {
    let trade = await Ticket.findOne({
        where: {
            channelid: channel.id
        }
    });

    if (trade.status == 10) {
        var currentTrade = channel.id;
        var termToSend = 0;

        termToSend = trade.terms;
        addressToSend = trade.address;


        var tradeMessage = config.confirmedTrade
            .replace("%amount%", trade.amount)
            .replace("%amountFee%", trade.amountFee + " BTC")
            .replace("%user1%", "<@" + trade.buyerID + ">")
            .replace("%user2%", "<@" + trade.sellerID + ">")
            .replace("%address%", addressToSend)
            .replace("%terms%", termToSend)
            .replace("%escrowStatus%", textStatus(trade.status)) +
            "";

        var safeTradeEmbed = new Discord.RichEmbed()
            .setTitle("Current Escrow Information:    ")
            .setDescription(tradeMessage + "❔ Admin Assistance").setColor("#df79ff");

        channel.send(safeTradeEmbed).then(async sentMessage => {
            await sentMessage.react("❔");
            channel.send("This ticket will be automatically closed in 10 minutes.");
            tradeReactMessage = sentMessage;
        });
        sendStatusEmbed(channel);
        setTimeout(clean, 10 * 60 * 1000, channel);
        var protect = 0;
        bot.on('messageReactionAdd', async (reaction, user) => {
            let trade = await Ticket.findOne({
                where: {
                    channelid: channel.id
                }
            });

            if (!user.bot && message.id == tradeReactMessage.id) {
                if (reaction.emoji.name == "❔") {
                    message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
                    bot.fetchUser("119893447846002690", false).then(user => {
                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                    })
                }
            }

        });
    }
    if (trade.status == 9) {
        var partialEmbed = new Discord.RichEmbed()
            .setDescription(`Partial Payment Detected, Please send the remaining **${trade.amountFee-trade.amountDeposited}** to **${trade.address}**`).setColor("#df79ff");
        channel.send(partialEmbed);
        await Ticket.update({
            status: 2
        }, {
            where: {
                channelid: channel.id
            }
        });

    }
    if (trade.status == 7) {
        var termToSend = 0;
        if (trade.terms == null) {
            termToSend = "Please add terms to the trade";
        } else {
            termToSend = trade.terms;
        }
        var addressToSend = 0;
        if (trade.address == null) {
            addressToSend = "No Address Yet";
        } else {
            addressToSend = trade.address;
        }


        var tradeMessage = config.confirmedTrade
            .replace("%amount%", trade.amount)
            .replace("%amountFee%", trade.amountFee + " BTC")
            .replace("%user1%", "<@" + trade.buyerID + ">")
            .replace("%user2%", "<@" + trade.sellerID + ">")
            .replace("%address%", addressToSend)
            .replace("%terms%", termToSend)
            .replace("%escrowStatus%", textStatus(trade.status)) +
            `https://www.blockchain.com/btc/tx/` + trade.txID;

        var completeEmbed = new Discord.RichEmbed()
            .setTitle("Current Escrow Information:    ")
            .setDescription(tradeMessage + "\n\n").setColor("#df79ff");
        channel.send(completeEmbed);

        var completeEmbed = new Discord.RichEmbed()
            .setTitle("Transaction Completed!")
            .setDescription("Congratulations on completing your trade!\n\n You will recieve a copy of this chat for future references. \n\n This ticket will be automatically closed in 10 minutes.");
        transcript(channel);

        setTimeout(clean, 10 * 60 * 1000, channel);

        channel.send(completeEmbed);

        updateStats(channel);

    } else if (trade.status == 5) {
        //confirmed embed
        //enable release and dispute
        //notify to send goods

        var currentTrade = channel.id;
        var termToSend = 0;

        termToSend = trade.terms;
        addressToSend = trade.address;


        var tradeMessage = config.confirmedTrade
            .replace("%amount%", trade.amount)
            .replace("%amountFee%", trade.amountFee + " BTC")
            .replace("%user1%", "<@" + trade.buyerID + ">")
            .replace("%user2%", "<@" + trade.sellerID + ">")
            .replace("%address%", addressToSend)
            .replace("%terms%", termToSend)
            .replace("%escrowStatus%", textStatus(trade.status)) +
            "";

        var tradeReactMessage = -1;


        var safeTradeEmbed = new Discord.RichEmbed()
            .setTitle("Current Escrow Information:    ")
            .setDescription(tradeMessage + "✅ Release Funds to Seller\n\n ❌ Cancel the Trade (Seller Only)\n\n❔ Admin Assistance").setColor("#df79ff");


        channel.send(safeTradeEmbed).then(async sentMessage => {
            await sentMessage.react("✅");
            await sentMessage.react("❌");
            await sentMessage.react("❔");
            tradeReactMessage = sentMessage;
        });
        sendStatusEmbed(channel);
        var protect = 0;
        bot.on('messageReactionAdd', async (reaction, user) => {
            let trade = await Ticket.findOne({
                where: {
                    channelid: channel.id
                }
            });
            if (trade.status >= 6) {
                return;
            }

            var message = reaction.message;
            if (!user.bot && message.id == tradeReactMessage.id) {
                reaction.remove(user);
            }
            if (!user.bot && message.id == tradeReactMessage.id) {
                if (reaction.emoji.name == "❌") {
                    //seller only
                    if (user.id == trade.sellerID) {
                        //cancel and refund

                        var tempEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> If you want to cancel this trade and refund the buyer then please reply with **CANCEL**").setColor("#df79ff");
                        await channel.send(tempEmbed);
                        var releaseConfirmed = 0;
                        channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                max: 1,
                                time: 300000,
                                errors: ['time'],
                            })
                            .then(async (collected) => {
                                console.log(collected.first().content);

                                if (collected.first().content == "CANCEL") {
                                    //confirmed release
                                    console.log(collected.first().content);
                                    var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> cancelled this escrow\n\n " + "<@" + trade.buyerID + "> please reply with your BTC address").setColor("#df79ff");
                                    await channel.send(btcEmbed);
                                    //await btc address
                                    channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                        max: 1,
                                        time: 300000,
                                        errors: ['time'],
                                    }).then(async (collected) => {
                                        var btcReply = collected.first().content;

                                        var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                        await channel.send(checkBtcEmbed);
                                        channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                            max: 1,
                                            time: 300000,
                                            errors: ['time'],
                                        }).then(async (collected) => {
                                            if (collected.first().content == "YES") {
                                                //release confirmed
                                                var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                await channel.send(shortlyEmbed);
                                                await Ticket.update({
                                                    status: 10
                                                }, {
                                                    where: {
                                                        channelid: channel.id
                                                    }
                                                }); //come back here
                                                await releaseTo(btcReply, channel);

                                            } else {
                                                channel.send("Invalid confirmation");
                                                //repeat
                                                var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> cancelled this escrow\n\n " + "<@" + trade.buyerID + "> please reply with your BTC address").setColor("#df79ff");
                                                await channel.send(btcEmbed);
                                                //await btc address
                                                channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                    max: 1,
                                                    time: 300000,
                                                    errors: ['time'],
                                                }).then(async (collected) => {
                                                    var btcReply = collected.first().content;

                                                    var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                    await channel.send(checkBtcEmbed);
                                                    channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                        max: 1,
                                                        time: 300000,
                                                        errors: ['time'],
                                                    }).then(async (collected) => {
                                                        if (collected.first().content == "YES") {
                                                            //release confirmed
                                                            var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                            await channel.send(shortlyEmbed);
                                                            await Ticket.update({
                                                                status: 10
                                                            }, {
                                                                where: {
                                                                    channelid: channel.id
                                                                }
                                                            }); //come back here
                                                            await releaseTo(btcReply, channel);

                                                        } else {
                                                            channel.send("Invalid confirmation");
                                                            var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> cancelled this escrow\n\n " + "<@" + trade.buyerID + "> please reply with your BTC address").setColor("#df79ff");
                                                            await channel.send(btcEmbed);
                                                            //await btc address
                                                            channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                                max: 1,
                                                                time: 300000,
                                                                errors: ['time'],
                                                            }).then(async (collected) => {
                                                                var btcReply = collected.first().content;

                                                                var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                                await channel.send(checkBtcEmbed);
                                                                channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                                    max: 1,
                                                                    time: 300000,
                                                                    errors: ['time'],
                                                                }).then(async (collected) => {
                                                                    if (collected.first().content == "YES") {
                                                                        //release confirmed
                                                                        var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                                        await channel.send(shortlyEmbed);
                                                                        await Ticket.update({
                                                                            status: 10
                                                                        }, {
                                                                            where: {
                                                                                channelid: channel.id
                                                                            }
                                                                        }); //come back here
                                                                        await releaseTo(btcReply, channel);

                                                                    } else {
                                                                        channel.send("Invalid confirmation");
                                                                        channel.send("Too many failures, an Administrator has been notified and will be here shortly.");
                                                                        bot.fetchUser("119893447846002690", false).then(user => {
                                                                            user.send(`Assistance required in ticket <#${message.channel.id}>`);
                                                                        });
                                                                    }

                                                                });
                                                            });
                                                        }

                                                    });
                                                });
                                            }

                                        });
                                    });

                                }
                            });
                    } else {
                        //buyer cant cancel a trade
                        channel.send(`<@${trade.buyerID}> as the buyer, you can't cancel the trade.`);
                        return;
                    }
                }
            }
            if (!user.bot && message.id == tradeReactMessage.id) {
                if (reaction.emoji.name == "❔") {
                    message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
                    bot.fetchUser("119893447846002690", false).then(user => {
                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                    })
                }

                if (reaction.emoji.name == "✅" && user.id == trade.buyerID) { //release funds

                    if (protect == 1) {
                        return;
                    } else {
                        protect = 1;
                    }

                    var tempEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> If you have recieved the agreed upon product/service, reply with **RELEASE**").setColor("#df79ff");
                    await channel.send(tempEmbed);
                    var releaseConfirmed = 0;
                    channel.awaitMessages(response => response.author.id == trade.buyerID, {
                            max: 1,
                            time: 300000,
                            errors: ['time'],
                        })
                        .then(async (collected) => {
                            console.log(collected.first().content);

                            if (collected.first().content == "RELEASE") {
                                //confirmed release
                                console.log(collected.first().content);
                                var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> released this escrow\n\n " + "<@" + trade.sellerID + "> please reply with your BTC address").setColor("#df79ff");
                                await channel.send(btcEmbed);
                                //await btc address
                                channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                    max: 1,
                                    time: 300000,
                                    errors: ['time'],
                                }).then(async (collected) => {
                                    var btcReply = collected.first().content;

                                    var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                    await channel.send(checkBtcEmbed);
                                    channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                        max: 1,
                                        time: 300000,
                                        errors: ['time'],
                                    }).then(async (collected) => {
                                        if (collected.first().content == "YES") {
                                            //release confirmed
                                            var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                            await channel.send(shortlyEmbed);
                                            await Ticket.update({
                                                status: 7
                                            }, {
                                                where: {
                                                    channelid: channel.id
                                                }
                                            });
                                            await releaseTo(btcReply, channel);

                                        } else {
                                            channel.send("Invalid confirmation");
                                            //repeat
                                            var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> released this escrow\n\n " + "<@" + trade.sellerID + "> please reply with your BTC address").setColor("#df79ff");
                                            await channel.send(btcEmbed);
                                            //await btc address
                                            channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                max: 1,
                                                time: 300000,
                                                errors: ['time'],
                                            }).then(async (collected) => {
                                                var btcReply = collected.first().content;

                                                var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                await channel.send(checkBtcEmbed);
                                                channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                    max: 1,
                                                    time: 300000,
                                                    errors: ['time'],
                                                }).then(async (collected) => {
                                                    if (collected.first().content == "YES") {
                                                        //release confirmed
                                                        var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                        await channel.send(shortlyEmbed);
                                                        await Ticket.update({
                                                            status: 7
                                                        }, {
                                                            where: {
                                                                channelid: channel.id
                                                            }
                                                        });
                                                        await releaseTo(btcReply, channel);

                                                    } else {
                                                        channel.send("Invalid confirmation");
                                                        var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> released this escrow\n\n " + "<@" + trade.sellerID + "> please reply with your BTC address").setColor("#df79ff");
                                                        await channel.send(btcEmbed);
                                                        //await btc address
                                                        channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                            max: 1,
                                                            time: 300000,
                                                            errors: ['time'],
                                                        }).then(async (collected) => {
                                                            var btcReply = collected.first().content;

                                                            var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                            await channel.send(checkBtcEmbed);
                                                            channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                                max: 1,
                                                                time: 300000,
                                                                errors: ['time'],
                                                            }).then(async (collected) => {
                                                                if (collected.first().content == "YES") {
                                                                    //release confirmed
                                                                    var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                                    await channel.send(shortlyEmbed);
                                                                    await Ticket.update({
                                                                        status: 7
                                                                    }, {
                                                                        where: {
                                                                            channelid: channel.id
                                                                        }
                                                                    });
                                                                    await releaseTo(btcReply, channel);

                                                                } else {
                                                                    channel.send("Invalid confirmation");
                                                                    channel.send("Too many failures, an Administrator has been notified and will be here shortly.");
                                                                    bot.fetchUser("119893447846002690", false).then(user => {
                                                                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                                                                    });
                                                                }

                                                            });
                                                        });
                                                    }

                                                });
                                            });
                                        }

                                    });
                                });

                            } else {
                                protect = 0;
                                channel.send("Invalid confirmation, please click the release button again and confirm.");
                            }

                        });


                }



            }




        });


    } else if (trade.status == 4) {
        //confirmed embed
        //enable release and dispute
        //notify to send goods
        var dispute = 0;
        var currentTrade = channel.id;
        var termToSend = 0;

        termToSend = trade.terms;
        addressToSend = trade.address;


        var tradeMessage = config.confirmedTrade
            .replace("%amount%", trade.amount)
            .replace("%amountFee%", trade.amountFee + " BTC")
            .replace("%user1%", "<@" + trade.buyerID + ">")
            .replace("%user2%", "<@" + trade.sellerID + ">")
            .replace("%address%", addressToSend)
            .replace("%terms%", termToSend)
            .replace("%escrowStatus%", textStatus(trade.status)) +
            "";

        var tradeReactMessage = -1;


        var safeTradeEmbed = new Discord.RichEmbed()
            .setTitle("Current Escrow Information:    ")
            .setDescription(tradeMessage + "The Escrow has been funded sucessfully.\n It is now  **SAFE ** to send the goods agreed on. \n\n ------------------------ \n\n " +
                "✅ Release Funds to Seller\n\n ❌ Cancel the Trade\n\n <:dispute:677702628943069225> Open Dispute \n\n❔ Admin Assistance").setColor("#df79ff");


        channel.send(safeTradeEmbed).then(async sentMessage => {
            await sentMessage.react("✅");
            await sentMessage.react("❌");
            await sentMessage.react("677702628943069225");
            await sentMessage.react("❔");
            tradeReactMessage = sentMessage;
            channel.send("<@" + trade.sellerID + "> please send " + "<@" + trade.buyerID + "> the product/service.");
        });
        sendStatusEmbed(channel);
        bot.on('messageReactionAdd', async (reaction, user) => {
            let trade = await Ticket.findOne({
                where: {
                    channelid: channel.id
                }
            });
            if (trade.status >= 5) {
                return;
            }

            var message = reaction.message;
            if (!user.bot && message.id == tradeReactMessage.id) {
                reaction.remove(user);
            }
            if (!user.bot && message.id == tradeReactMessage.id) {
                if (reaction.emoji.name == "❔") {
                    message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
                    bot.fetchUser("119893447846002690", false).then(user => {
                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                    })
                }

                console.log(user.id);
                console.log(trade.buyerID);
                if (reaction.emoji.name == "✅" && user.id == trade.buyerID) { //release funds


                    var tempEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> If you have recieved the agreed upon product/service, reply with **RELEASE**").setColor("#df79ff");
                    await channel.send(tempEmbed);
                    var releaseConfirmed = 0;
                    channel.awaitMessages(response => response.author.id == trade.buyerID, {
                            max: 1,
                            time: 300000,
                            errors: ['time'],
                        })
                        .then(async (collected) => {
                            console.log(collected.first().content);

                            if (collected.first().content == "RELEASE") {
                                //confirmed release
                                console.log(collected.first().content);
                                var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> released this escrow\n\n " + "<@" + trade.sellerID + "> please reply with your BTC address").setColor("#df79ff");
                                await channel.send(btcEmbed);
                                //await btc address
                                channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                    max: 1,
                                    time: 300000,
                                    errors: ['time'],
                                }).then(async (collected) => {
                                    var btcReply = collected.first().content;

                                    var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                    await channel.send(checkBtcEmbed);
                                    channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                        max: 1,
                                        time: 300000,
                                        errors: ['time'],
                                    }).then(async (collected) => {
                                        if (collected.first().content == "YES") {
                                            //release confirmed
                                            var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                            await channel.send(shortlyEmbed);
                                            await Ticket.update({
                                                status: 7
                                            }, {
                                                where: {
                                                    channelid: channel.id
                                                }
                                            });
                                            releaseTo(btcReply, channel);

                                        } else {
                                            channel.send("Invalid confirmation");
                                            //repeat
                                            var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> released this escrow\n\n " + "<@" + trade.sellerID + "> please reply with your BTC address").setColor("#df79ff");
                                            await channel.send(btcEmbed);
                                            //await btc address
                                            channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                max: 1,
                                                time: 300000,
                                                errors: ['time'],
                                            }).then(async (collected) => {
                                                var btcReply = collected.first().content;

                                                var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                await channel.send(checkBtcEmbed);
                                                channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                    max: 1,
                                                    time: 300000,
                                                    errors: ['time'],
                                                }).then(async (collected) => {
                                                    if (collected.first().content == "YES") {
                                                        //release confirmed
                                                        var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                        await channel.send(shortlyEmbed);
                                                        await Ticket.update({
                                                            status: 7
                                                        }, {
                                                            where: {
                                                                channelid: channel.id
                                                            }
                                                        });
                                                        releaseTo(btcReply, channel);

                                                    } else {
                                                        channel.send("Invalid confirmation");
                                                        var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> released this escrow\n\n " + "<@" + trade.sellerID + "> please reply with your BTC address").setColor("#df79ff");
                                                        await channel.send(btcEmbed);
                                                        //await btc address
                                                        channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                            max: 1,
                                                            time: 300000,
                                                            errors: ['time'],
                                                        }).then(async (collected) => {
                                                            var btcReply = collected.first().content;

                                                            var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                            await channel.send(checkBtcEmbed);
                                                            channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                                                max: 1,
                                                                time: 300000,
                                                                errors: ['time'],
                                                            }).then(async (collected) => {
                                                                if (collected.first().content == "YES") {
                                                                    //release confirmed
                                                                    var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                                    await channel.send(shortlyEmbed);
                                                                    await Ticket.update({
                                                                        status: 7
                                                                    }, {
                                                                        where: {
                                                                            channelid: channel.id
                                                                        }
                                                                    });
                                                                    releaseTo(btcReply, channel);

                                                                } else {
                                                                    channel.send("Invalid confirmation");
                                                                    channel.send("Too many failures, an Administrator has been notified and will be here shortly.");
                                                                    bot.fetchUser("119893447846002690", false).then(user => {
                                                                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                                                                    });
                                                                }

                                                            });
                                                        });
                                                    }

                                                });
                                            });
                                        }

                                    });
                                });

                            } else {
                                channel.send("Invalid confirmation, please click the release button again and confirm.");
                            }

                        });


                }
                if (reaction.emoji == "<:dispute:677702628943069225>") {
                    //open dispute
                    if (dispute == 1) {
                        channel.send("Dispute Already Opened, please wait for an Administrator.")
                        return;
                    } else {
                        dispute = 1;
                    }
                    await Ticket.update({
                        status: 5
                    }, {
                        where: {
                            channelid: channel.id
                        }
                    });
                    channel.send("**DISPUTE OPENED**");
                    channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
                    bot.fetchUser("119893447846002690", false).then(user => {
                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                    })
                    sendStatusEmbed(channel);
                    sendTotalEmbed(channel);

                }
                if (!user.bot && message.id == tradeReactMessage.id) {
                    if (reaction.emoji.name == "❌") {
                        //seller only
                        if (user.id == trade.sellerID) {
                            //cancel and refund

                            var tempEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> If you want to cancel this trade and refund the buyer then please reply with **CANCEL**").setColor("#df79ff");
                            await channel.send(tempEmbed);
                            var releaseConfirmed = 0;
                            channel.awaitMessages(response => response.author.id == trade.sellerID, {
                                    max: 1,
                                    time: 300000,
                                    errors: ['time'],
                                })
                                .then(async (collected) => {
                                    console.log(collected.first().content);

                                    if (collected.first().content == "CANCEL") {
                                        //confirmed release
                                        console.log(collected.first().content);
                                        var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> cancelled this escrow\n\n " + "<@" + trade.buyerID + "> please reply with your BTC address").setColor("#df79ff");
                                        await channel.send(btcEmbed);
                                        //await btc address
                                        channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                            max: 1,
                                            time: 300000,
                                            errors: ['time'],
                                        }).then(async (collected) => {
                                            var btcReply = collected.first().content;

                                            var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                            await channel.send(checkBtcEmbed);
                                            channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                max: 1,
                                                time: 300000,
                                                errors: ['time'],
                                            }).then(async (collected) => {
                                                if (collected.first().content == "YES") {
                                                    //release confirmed
                                                    var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                    await channel.send(shortlyEmbed);
                                                    await Ticket.update({
                                                        status: 10
                                                    }, {
                                                        where: {
                                                            channelid: channel.id
                                                        }
                                                    }); //come back here
                                                    await releaseTo(btcReply, channel);

                                                } else {
                                                    channel.send("Invalid confirmation");
                                                    //repeat
                                                    var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> cancelled this escrow\n\n " + "<@" + trade.buyerID + "> please reply with your BTC address").setColor("#df79ff");
                                                    await channel.send(btcEmbed);
                                                    //await btc address
                                                    channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                        max: 1,
                                                        time: 300000,
                                                        errors: ['time'],
                                                    }).then(async (collected) => {
                                                        var btcReply = collected.first().content;

                                                        var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                        await channel.send(checkBtcEmbed);
                                                        channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                            max: 1,
                                                            time: 300000,
                                                            errors: ['time'],
                                                        }).then(async (collected) => {
                                                            if (collected.first().content == "YES") {
                                                                //release confirmed
                                                                var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                                await channel.send(shortlyEmbed);
                                                                await Ticket.update({
                                                                    status: 10
                                                                }, {
                                                                    where: {
                                                                        channelid: channel.id
                                                                    }
                                                                }); //come back here
                                                                await releaseTo(btcReply, channel);

                                                            } else {
                                                                channel.send("Invalid confirmation");
                                                                var btcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.sellerID + "> cancelled this escrow\n\n " + "<@" + trade.buyerID + "> please reply with your BTC address").setColor("#df79ff");
                                                                await channel.send(btcEmbed);
                                                                //await btc address
                                                                channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                                    max: 1,
                                                                    time: 300000,
                                                                    errors: ['time'],
                                                                }).then(async (collected) => {
                                                                    var btcReply = collected.first().content;

                                                                    var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> please confirm your BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
                                                                    await channel.send(checkBtcEmbed);
                                                                    channel.awaitMessages(response => response.author.id == trade.buyerID, {
                                                                        max: 1,
                                                                        time: 300000,
                                                                        errors: ['time'],
                                                                    }).then(async (collected) => {
                                                                        if (collected.first().content == "YES") {
                                                                            //release confirmed
                                                                            var shortlyEmbed = new Discord.RichEmbed().setDescription("<@" + trade.buyerID + "> You will recieve your funds shortly.").setColor("#df79ff");
                                                                            await channel.send(shortlyEmbed);
                                                                            await Ticket.update({
                                                                                status: 10
                                                                            }, {
                                                                                where: {
                                                                                    channelid: channel.id
                                                                                }
                                                                            }); //come back here
                                                                            await releaseTo(btcReply, channel);

                                                                        } else {
                                                                            channel.send("Invalid confirmation");
                                                                            channel.send("Too many failures, an Administrator has been notified and will be here shortly.");
                                                                            bot.fetchUser("119893447846002690", false).then(user => {
                                                                                user.send(`Assistance required in ticket <#${message.channel.id}>`);
                                                                            });
                                                                        }

                                                                    });
                                                                });
                                                            }

                                                        });
                                                    });
                                                }

                                            });
                                        });

                                    }
                                });
                        } else {
                            channel.send(`<@${trade.buyerID}> as the buyer, you can't cancel the trade.`);
                            return;
                        }
                    }
                }


            }




        });


    } else if (trade.status == 3) {
        //waiting confirmations embed


        var currentTrade = channel.id;
        var termToSend = 0;

        termToSend = trade.terms;
        addressToSend = trade.address;


        var tradeMessage = config.confirmedTrade
            .replace("%amount%", trade.amount)
            .replace("%amountFee%", trade.amountFee + " BTC")
            .replace("%user1%", "<@" + trade.buyerID + ">")
            .replace("%user2%", "<@" + trade.sellerID + ">")
            .replace("%address%", addressToSend)
            .replace("%terms%", termToSend)
            .replace("%escrowStatus%", textStatus(trade.status)) +
            "❔ Admin Assistance";

        var tradeReactMessage = -1;
        var tradeEmbed = new Discord.RichEmbed()
            .setTitle("Current Escrow Information:    ")
            .setDescription(tradeMessage).setColor("#df79ff");

        channel.send(tradeEmbed).then(async sentMessage => {
            await sentMessage.react("❔");
            tradeReactMessage = sentMessage;
        });
        sendStatusEmbed(channel);
        bot.on('messageReactionAdd', async (reaction, user) => {
            let trade = await Ticket.findOne({
                where: {
                    channelid: channel.id
                }
            });
            if (trade.status >= 4) {
                return;
            }
            var message = reaction.message;
            if (!user.bot && message.id == tradeReactMessage.id) {
                reaction.remove(user);
            }
            if (!user.bot && message.id == tradeReactMessage.id) {


                if (reaction.emoji.name == "❔") {
                    message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
                    bot.fetchUser("119893447846002690", false).then(user => {
                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                    })
                }



            }




        });




    } else if (trade.status == 2) {
        //new embed
        let trade = await Ticket.findOne({
            where: {
                channelid: channel.id
            }
        });
        if (trade.status == 3) {
            return;
        }
        var currentTrade = channel.id;
        var termToSend = 0;

        termToSend = trade.terms;
        addressToSend = trade.address;

        var tradeMessage = config.onGoingTrade
            .replace("%amount%", trade.amount)
            .replace("%amountFee%", trade.amountFee + " BTC")
            .replace("%user1%", "<@" + trade.buyerID + ">")
            .replace("%user2%", "<@" + trade.sellerID + ">")
            .replace("%address%", addressToSend)
            .replace("%terms%", termToSend)
            .replace("%escrowStatus%", textStatus(trade.status)) +
            "\n\n";

        var tradeReactMessage = -1;
        var tradeEmbed = new Discord.RichEmbed()
            .setTitle("Current Escrow Information:    ")
            .setDescription(tradeMessage).setColor("#df79ff");

        channel.send(tradeEmbed).then(async sentMessage => {
            await sentMessage.react("❔");
            tradeReactMessage = sentMessage;
        });
        sendStatusEmbed(channel);
        bot.on('messageReactionAdd', async (reaction, user) => {
            let trade = await Ticket.findOne({
                where: {
                    channelid: channel.id
                }
            });
            if (trade.status >= 3) {
                return;
            }

            var message = reaction.message;
            if (!user.bot && message.id == tradeReactMessage.id) {
                reaction.remove(user);
            }
            if (!user.bot && message.id == tradeReactMessage.id) {

                if (reaction.emoji.name == "❔") {
                    message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
                    bot.fetchUser("119893447846002690", false).then(user => {
                        user.send(`Assistance required in ticket <#${message.channel.id}>`);
                    })
                }

            }

        });

    } else {
        if (trade.status < 2) {
            var currentTrade = channel.id;
            var termToSend = 0;
            if (trade.terms == null) {
                termToSend = "Please add terms to the trade";
            } else {
                termToSend = trade.terms;
            }
            var addressToSend = 0;
            if (trade.address == null) {
                addressToSend = "No Address Yet";
            } else {
                addressToSend = trade.address;
            }

            var tradeMessage = config.tradeMessageContents
                .replace("%amount%", trade.amount)
                .replace("%amountFee%", trade.amountFee + " BTC")
                .replace("%user1%", "<@" + trade.buyerID + ">")
                .replace("%user2%", "<@" + trade.sellerID + ">")
                .replace("%address%", addressToSend)
                .replace("%terms%", termToSend)
                .replace("%escrowStatus%", textStatus(trade.status)) +
                "\n\n";

            var tradeReactMessage = -1;
            var tradeEmbed = new Discord.RichEmbed()
                .setTitle("Current Escrow Information:    ")
                .setDescription(tradeMessage).setColor("#df79ff");
            if (tradeReactMessage != -1) {
                tradeReactMessage.delete(1000);
            }
            channel.send(tradeEmbed).then(async sentMessage => {
                await sentMessage.react("💵");
                await sentMessage.react("✏️");
                await sentMessage.react("✅");
                await sentMessage.react("❌");
                await sentMessage.react("❔");
                tradeReactMessage = sentMessage;
                if (trade.amount == 0 && trade.terms == null)
                    channel.send("To begin with, please enter the amount of the trade by clicking the 💵 button.");
                if (trade.amount != 0 && trade.terms == null)
                    channel.send("Now please add terms to the trade by clicking the ✏️ button. \n*Terms can be a description of the product/service*");
                if (trade.terms != null && trade.status < 2)
                    channel.send("Now both users need to accept the terms and amount by clicking the ✅ button.\n*Please read the terms and amount carefully*");



            });

            sendStatusEmbed(channel);
            bot.on('messageReactionAdd', async (reaction, user) => {
                let trade = await Ticket.findOne({
                    where: {
                        channelid: channel.id
                    }
                });
                if (trade.status >= 2) {
                    return;
                }
                var message = reaction.message;
                if (!user.bot && message.id == tradeReactMessage.id) {
                    reaction.remove(user);
                }
                if (!user.bot && message.id == tradeReactMessage.id) {
                    if (reaction.emoji.name == "❔") {
                        message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
                        bot.fetchUser("119893447846002690", false).then(user => {
                            user.send(`Assistance required in ticket <#${message.channel.id}>`);
                        })
                    }

                    if (reaction.emoji.name == "✅") {

                        userAction(user.id, tradeReactMessage.channel, 1);
                    }
                    if (reaction.emoji.name == "❌") {

                        userAction(user.id, tradeReactMessage.channel, 0);

                    }
                    if (reaction.emoji.name == "✏️") {

                        if (trade.amount == 0) {
                            channel.send("Please first state the amount **in BTC** for the trade.")
                            return;
                        }
                        if (trade.status == 2) {
                            resetTrade(channel);
                            channel.send("Trade modified after escrow opened\n **The trade has been reset for security reasons.**");
                            return;

                        }
                        var tempEmbed = new Discord.RichEmbed().setDescription("Please enter new terms for this trade:").setColor("#df79ff");
                        await channel.send(tempEmbed);
                        if (trade.buyerStatus == 1 || trade.sellerStatus == 1)
                            resetTrade(channel);
                        channel.awaitMessages(response => response.author.id === user.id, {
                                max: 1,
                                time: 300000,
                                errors: ['time'],
                            })
                            .then(async (collected) => {
                                await Ticket.update({
                                    terms: collected.first().content
                                }, {
                                    where: {
                                        channelid: channel.id
                                    }
                                });

                                channel.send("Terms Updated!");
                                sendTotalEmbed(channel);

                            })
                            .catch(() => {
                            });




                    }
                    if (reaction.emoji.name == "💵") {
                        var SelectedTicket = await Ticket.findOne({
                            where: {
                                channelid: channel.id
                            }
                        });
                        if (SelectedTicket.status == 2) {
                            resetTrade(channel);
                            channel.send("Trade modified after escrow opened\n **The trade has been reset for security reasons.**");
                            return;
                        }
                        var tempEmbed = new Discord.RichEmbed().setDescription("Please enter **new amount in BTC** for this trade:").setColor("#df79ff");
                        await channel.send(tempEmbed);
                        if (SelectedTicket.buyerStatus == 1 || SelectedTicket.sellerStatus == 1)
                            resetTrade(channel);
                        channel.awaitMessages(response => response.author.id === user.id, {
                                max: 1,
                                time: 300000,
                                errors: ['time'],
                            })
                            .then(async (collected) => {
                                if (collected.first().content <= freeThreshhold)
                                    fee = 0;
                                else
                                    fee = 0.03;
                                if (collected.first().content < 0.00049) {
                                    channel.send("Minimum Trade amount is 0.00049 BTC ($5 USD)");
                                    return;
                                }
                                await Ticket.update({
                                    amount: collected.first().content,
                                    amountFee: ((1 + fee) * collected.first().content).toFixed(8)
                                }, {
                                    where: {
                                        channelid: channel.id
                                    }
                                });

                                channel.send("Amount Updated! *The escrow fee of " + fee * 100 + "% has been added to the amount*");
                                await Ticket.update({
                                    buyerStatus: 0,
                                    sellerStatus: 0
                                }, {
                                    where: {
                                        channelid: channel.id
                                    }
                                });

                                if (SelectedTicket.status == 2) {
                                    await Ticket.update({
                                        status: 1,
                                        buyerStatus: 0,
                                        sellerStatus: 0
                                    }, {
                                        where: {
                                            channelid: channel.id
                                        }
                                    });



                                }
                                sendTotalEmbed(channel);


                            })
                            .catch(() => {
                                //channel.send('There was no collected message that passed the filter within the time limit!');
                            });




                    }


                }




            });

        }


    }
}

function registerReactionEvents() {
    Object.keys(ticketTypes).forEach(ticketType => {
        bot.on('messageReactionAdd', (reaction, user) => {
            var message = reaction.message;

            // If user is reacting to our support welcome message.
            if (!user.bot && message.id == welcomeMessageId) {
                var section = ticketTypes[ticketType];

                if (reaction.emoji.name == section.reaction) {
                    createChannelForTicketType(message.guild, section, user);


                }
            }
        });
    });
}



async function transcript(channel) {
    var trade = await Ticket.findOne({
        where: {
            channelid: channel.id
        }
    });

    let messageCollection = new Discord.Collection();
    let channelMessages = await channel.fetchMessages({
        limit: 100
    }).catch(err => console.log(err));

    messageCollection = messageCollection.concat(channelMessages);

    while (channelMessages.size === 100) {
        let lastMessageId = channelMessages.lastKey();
        channelMessages = await channel.fetchMessages({
            limit: 100,
            before: lastMessageId
        }).catch(err => console.log(err));
        if (channelMessages)
            messageCollection = messageCollection.concat(channelMessages);
    }
    let msgs = messageCollection.array().reverse();
    let data = await fs.readFile('./template.html', 'utf8').catch(err => console.log(err));
    if (data) {
        await fs.writeFile(`./logs/${channel.name}.html`, data).catch(err => console.log(err));
        let guildElement = document.createElement('div');
        let guildInfo = document.createElement('div');
        let guildName = document.createElement('div');
        let guildChannel = document.createElement('div');
        let guildIconContainer = document.createElement('div');
        let guildText = document.createTextNode(channel.guild.name);
        let guildn = document.createTextNode(channel.name);

        let guildImg = document.createElement('img');
        guildImg.setAttribute('class', 'info__guild-icon');
        guildIconContainer.setAttribute('class', 'info__guild-icon-container');

        guildIconContainer.appendChild(guildImg);
        guildImg.setAttribute('src', channel.guild.iconURL);
        guildInfo.setAttribute('class', 'info__metadata');
        guildName.setAttribute('class', 'info__guild-name');
        guildName.appendChild(guildText);

        guildChannel.setAttribute('class', 'info__channel-name');
        guildChannel.appendChild(guildn);

        guildInfo.appendChild(guildName);
        guildInfo.appendChild(guildChannel);

        guildElement.appendChild(guildIconContainer);

        guildElement.appendChild(guildInfo);
        guildElement.setAttribute('class', "info");
        console.log(guildElement.outerHTML);
        await fs.appendFile(`./logs/${channel.name}.html`, guildElement.outerHTML).catch(err => console.log(err));

        msgs.forEach(async msg => {
            var color = msg.member.displayHexColor;
            let parentContainer = document.createElement("div");
            parentContainer.className = "parent-container";

            let avatarDiv = document.createElement("div");
            avatarDiv.className = "avatar-container";
            let img = document.createElement('img');
            img.setAttribute('src', msg.author.displayAvatarURL);
            img.className = "avatar";
            avatarDiv.appendChild(img);

            parentContainer.appendChild(avatarDiv);

            let messageContainer = document.createElement('div');
            messageContainer.className = "message-container";

            let nameElement = document.createElement("span");

            var botContainer = document.createElement("span");
            var botName = msg.author;
            var botTag = document.createTextNode("BOT");
            botContainer.setAttribute('class', 'chatlog__bot-tag');
            botContainer.appendChild(botTag);

            var nameOnly = document.createElement("span");
            var dateOnly = document.createElement("span");

            let name = document.createTextNode(msg.author.username);
            nameOnly.appendChild(name);
            nameOnly.setAttribute('class', "chatlog__author-name");
            nameOnly.setAttribute('style', `color:${color}`);
            let rest = document.createTextNode(" " + msg.createdAt.toDateString() + " " + msg.createdAt.toLocaleTimeString() + " CET");
            dateOnly.appendChild(rest);
            dateOnly.setAttribute('class', 'chatlog__timestamp');




            if (msg.author.tag == "Escrow#6909") {
                var nameOnly = document.createElement("span");

                let name = document.createTextNode(msg.author.username);
                nameOnly.appendChild(name);
                nameOnly.setAttribute('class', "chatlog__author-name");
                nameOnly.setAttribute('style', `color:${color}`);

                nameElement.appendChild(nameOnly);

                nameElement.appendChild(botContainer);
                nameElement.appendChild(dateOnly);
            } else {
                nameElement.appendChild(nameOnly);
                nameElement.appendChild(dateOnly);

            }
            messageContainer.append(nameElement);
            if (msg.content.startsWith("```")) {
                let m = msg.content.replace(/```/g, "");
                let codeNode = document.createElement("code");
                let textNode = document.createTextNode(m);
                codeNode.appendChild(textNode);
                messageContainer.appendChild(codeNode);
            } else {
                let msgNode = document.createElement('span');

                let textNode = document.createTextNode(msg.content);
                let embedContainer = document.createElement('div');
                let embedContent = document.createElement('div');
                let embedPill = document.createElement('div');
                let embedDescription = document.createElement('div');
                let embedBigContainer = document.createElement('div'); //chatlog__embed
                embedBigContainer.setAttribute('class', "chatlog__embed");
                embedContainer.setAttribute('class', "chatlog__embed-content-container");
                embedPill.setAttribute('class', "chatlog__embed-color-pill");
                embedDescription.setAttribute('class', "chatlog__embed-description");

                //come back ere

                msg.embeds.forEach((embed) => {
                    let text = embed.description;
                    let text2 = text.replace(/(?:\r\n|\r|\n)/g, '<br>');


                    let textNode = document.createElement('div');
                    textNode.innerHTML = text2;
                    embedPill.setAttribute('style', `background-color:#df79ff`);
                    embedContent.appendChild(msgNode);
                    embedDescription.appendChild(textNode);

                    embedContainer.appendChild(embedContent);
                    embedContainer.appendChild(embedDescription);

                    embedBigContainer.appendChild(embedPill);
                    embedBigContainer.appendChild(embedContainer);

                    messageContainer.appendChild(embedBigContainer);

                });
                msgNode.append(textNode);
                messageContainer.appendChild(msgNode);
            }
            parentContainer.appendChild(messageContainer);
            await fs.appendFile(`./logs/${channel.name}.html`, parentContainer.outerHTML).catch(err => console.log(err));
        });
    }


    bot.fetchUser(`${trade.buyerID}`, false).then(user => {
        user.send("Thank you for using the Levathian Escrow Bot, here is the transcript of your recent trade.", {
            files: [
                `./logs/${channel.name}.html`
            ]
        });
    });
    bot.fetchUser(`${trade.sellerID}`, false).then(user => {
        user.send("Thank you for using the Levathian Escrow Bot, here is the transcript of your recent trade.", {
            files: [
                `./logs/${channel.name}.html`
            ]
        });
    })

}


bot.on("message", async message => {
    //Log

    if (message.content.toLowerCase() === '!transcript') {

        await message.delete();
        let messageCollection = new Discord.Collection();
        let channelMessages = await message.channel.fetchMessages({
            limit: 100
        }).catch(err => console.log(err));

        messageCollection = messageCollection.concat(channelMessages);

        while (channelMessages.size === 100) {
            let lastMessageId = channelMessages.lastKey();
            channelMessages = await message.channel.fetchMessages({
                limit: 100,
                before: lastMessageId
            }).catch(err => console.log(err));
            if (channelMessages)
                messageCollection = messageCollection.concat(channelMessages);
        }
        let msgs = messageCollection.array().reverse();
        let data = await fs.readFile('./template.html', 'utf8').catch(err => console.log(err));
        if (data) {
            await fs.writeFile(`${message.channel.name}.html`, data).catch(err => console.log(err));
            let guildElement = document.createElement('div');
            let guildInfo = document.createElement('div');
            let guildName = document.createElement('div');
            let guildChannel = document.createElement('div');
            let guildIconContainer = document.createElement('div');

            let guildText = document.createTextNode(message.guild.name);
            let guildn = document.createTextNode(message.channel.name);

            let guildImg = document.createElement('img');
            guildImg.setAttribute('class', 'info__guild-icon');
            guildIconContainer.setAttribute('class', 'info__guild-icon-container');

            guildIconContainer.appendChild(guildImg);
            guildImg.setAttribute('src', message.guild.iconURL);
            guildInfo.setAttribute('class', 'info__metadata');
            guildName.setAttribute('class', 'info__guild-name');
            guildName.appendChild(guildText);

            guildChannel.setAttribute('class', 'info__channel-name');
            guildChannel.appendChild(guildn);

            guildInfo.appendChild(guildName);
            guildInfo.appendChild(guildChannel);

            guildElement.appendChild(guildIconContainer);

            guildElement.appendChild(guildInfo);
            guildElement.setAttribute('class', "info");
            console.log(guildElement.outerHTML);
            await fs.appendFile(`${message.channel.name}.html`, guildElement.outerHTML).catch(err => console.log(err));

            msgs.forEach(async msg => {
                var color = msg.member.displayHexColor;
                let parentContainer = document.createElement("div");
                parentContainer.className = "parent-container";

                let avatarDiv = document.createElement("div");
                avatarDiv.className = "avatar-container";
                let img = document.createElement('img');
                img.setAttribute('src', msg.author.displayAvatarURL);
                img.className = "avatar";
                avatarDiv.appendChild(img);

                parentContainer.appendChild(avatarDiv);

                let messageContainer = document.createElement('div');
                messageContainer.className = "message-container";

                let nameElement = document.createElement("span");

                var botContainer = document.createElement("span");
                var botName = msg.author;
                var botTag = document.createTextNode("BOT");
                botContainer.setAttribute('class', 'chatlog__bot-tag');
                botContainer.appendChild(botTag);

                var nameOnly = document.createElement("span");
                var dateOnly = document.createElement("span");

                let name = document.createTextNode(msg.author.username);
                nameOnly.appendChild(name);
                nameOnly.setAttribute('class', "chatlog__author-name");
                nameOnly.setAttribute('style', `color:${color}`);
                let rest = document.createTextNode(" " + msg.createdAt.toDateString() + " " + msg.createdAt.toLocaleTimeString() + " CET");
                dateOnly.appendChild(rest);
                dateOnly.setAttribute('class', 'chatlog__timestamp');




                if (msg.author.tag == "Escrow#6909") {
                    var nameOnly = document.createElement("span");

                    let name = document.createTextNode(msg.author.username);
                    nameOnly.appendChild(name);
                    nameOnly.setAttribute('class', "chatlog__author-name");
                    nameOnly.setAttribute('style', `color:${color}`);

                    nameElement.appendChild(nameOnly);

                    nameElement.appendChild(botContainer);
                    nameElement.appendChild(dateOnly);
                } else {
                    nameElement.appendChild(nameOnly);
                    nameElement.appendChild(dateOnly);

                }
                messageContainer.append(nameElement);
                if (msg.content.startsWith("```")) {
                    let m = msg.content.replace(/```/g, "");
                    let codeNode = document.createElement("code");
                    let textNode = document.createTextNode(m);
                    codeNode.appendChild(textNode);
                    messageContainer.appendChild(codeNode);
                } else {
                    let msgNode = document.createElement('span');

                    let textNode = document.createTextNode(msg.content);
                    let embedContainer = document.createElement('div');
                    let embedContent = document.createElement('div');
                    let embedPill = document.createElement('div');
                    let embedDescription = document.createElement('div');
                    let embedBigContainer = document.createElement('div'); //chatlog__embed
                    embedBigContainer.setAttribute('class', "chatlog__embed");
                    embedContainer.setAttribute('class', "chatlog__embed-content-container");
                    embedPill.setAttribute('class', "chatlog__embed-color-pill");
                    embedDescription.setAttribute('class', "chatlog__embed-description");

                    //come back ere

                    msg.embeds.forEach((embed) => {
                        let text = embed.description;
                        let text2 = text.replace(/(?:\r\n|\r|\n)/g, '<br>');


                        let textNode = document.createElement('div');
                        textNode.innerHTML = text2;
                        embedPill.setAttribute('style', `background-color:#df79ff`);
                        embedContent.appendChild(msgNode);
                        embedDescription.appendChild(textNode);

                        embedContainer.appendChild(embedContent);
                        embedContainer.appendChild(embedDescription);

                        embedBigContainer.appendChild(embedPill);
                        embedBigContainer.appendChild(embedContainer);

                        messageContainer.appendChild(embedBigContainer);

                    });
                    msgNode.append(textNode);
                    messageContainer.appendChild(msgNode);
                }
                parentContainer.appendChild(messageContainer);
                await fs.appendFile(`${message.channel.name}.html`, parentContainer.outerHTML).catch(err => console.log(err));
            });
        }
    }

    //log end
    if (message.author.bot) return;
    if (message.content.indexOf('!') !== 0) return;
    var checkValid = await Ticket.findOne({
        where: {
            channelid: message.channel.id
        }
    });

    if (checkValid == undefined) {
        //command being used outside of valid channel
        message.channel.send("Escrow command cannot be used outside escrow channel!");
        return;
    }
    var added = false;


    var args = message.content.slice(1).trim().split(/ +/g);
    var command = args.shift().toLowerCase();
    //start add command

    if (command == 'refund' && message.author.id == 119893447846002690) {
        var channel = message.channel;
        var btcEmbed = new Discord.RichEmbed().setDescription("<@" + 119893447846002690 + "> released this escrow\n\n " + " please reply with the BTC address").setColor("#df79ff");
        await channel.send(btcEmbed);
        //await btc address
        channel.awaitMessages(response => response.author.id == 119893447846002690, {
            max: 1,
            time: 300000,
            errors: ['time'],
        }).then(async (collected) => {
            var btcReply = collected.first().content;

            var checkBtcEmbed = new Discord.RichEmbed().setDescription("<@" + 119893447846002690 + "> please confirm the BTC address is: **" + btcReply + "** by replying with **YES**").setColor("#df79ff");
            await channel.send(checkBtcEmbed);
            channel.awaitMessages(response => response.author.id == 119893447846002690, {
                max: 1,
                time: 300000,
                errors: ['time'],
            }).then(async (collected) => {
                if (collected.first().content == "YES") {
                    //release confirmed
                    var shortlyEmbed = new Discord.RichEmbed().setDescription("Sending...").setColor("#df79ff");
                    await channel.send(shortlyEmbed);
                    await Ticket.update({
                        status: 7
                    }, {
                        where: {
                            channelid: channel.id
                        }
                    });
                    releaseTo(btcReply, channel);

                } else {
                    channel.send("invalid response");
                }


            })
        })
    }
    if (command == 'fee' && message.author.id == 119893447846002690) {
        var config = Stat.findOne({
            where: {
                id: 1
            }
        });

        freeThreshhold = config.freeThreshhold;
    }

    if (command == 'delete' && message.author.id == 119893447846002690) {
        setTimeout(clean, 0.01 * 60 * 1000, message.channel);

    }
    if (command == 'fresh' && message.author.id == 119893447846002690) {

        sendTotalEmbed(message.channel);

    }
    if (command == 'help') {
        return;
        var helpMessage = new Discord.RichEmbed()
            .setTitle("Escrow Bot Help:")
            .setDescription("**1)** Add a seller via the command **!add usertag#001**\n\n**2)** Click the ** ✏️ Edit Terms Button** to add/edit the trade description\n\n**3)** Click the ✅ **Accept Terms Button** to accept the terms, \nor the ❌ **Reject Terms Button **to reject the terms\n\n*When both users accept the terms, the escrow will be ready to refund*")
            .setFooter("Please make sure to provide accurate trade terms.").setColor("#ffffff");
        message.channel.send(helpMessage);
    }

    //end add command

    //start assist command
    if (command == "assist") {
        message.channel.send("<@" + 119893447846002690 + "> has been notified and will be here shortly.")
        bot.fetchUser("119893447846002690", false).then(user => {
            user.send(`Assistance required in ticket <#${message.channel.id}>`);
        }) //
    }
    //end assist command



});
async function createChannelForTicketType(guild, ticketType, user) {
    var channelName = ticketType.title;
    //  var messageBody = ticketType.messageBody.replace("%username%", user.username);
    var parent = guild.channels.get(ticketType.parent);


    if (ticketType["type"] == "support") {

        var roleEveryone = guild.roles.find(r => r.name == '@everyone');
        var rolePermitAll = guild.roles.find(r => r.name == 'Admin');




        guild.createChannel(channelName, 'text').then(async channel => {
            channel.overwritePermissions(roleEveryone, {
                VIEW_CHANNEL: false,
                SEND_MESSAGES: false,
                ATTACH_FILES: false,
                CREATE_INSTANT_INVITE: false
            });
            channel.overwritePermissions(user.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true,
                ATTACH_FILES: true
            });
            channel.overwritePermissions(rolePermitAll.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true,
                ATTACH_FILES: true
            });

            channel.setParent(parent.id);
            await channel.edit({
                name: `${channel.name}-${user.username}`
            });
            channel.send("Please wait, an Administrator will shortly be here...");


        });


    }




    //var channelAlreadyExists = guild.channels.find(c => c.type == "text" && c.name == channelName) != null;
    if (ticketType["type"] == "escrow") {
        console.log("Creating Escrow for " + user.username + " (" + user.id + ")");

        var roleEveryone = guild.roles.find(r => r.name == '@everyone');
        var rolePermitAll = guild.roles.find(r => r.name == 'Admin');




        guild.createChannel(channelName, 'text').then(async channel => {
            channel.overwritePermissions(roleEveryone, {
                VIEW_CHANNEL: false,
                SEND_MESSAGES: false,
                ATTACH_FILES: false,
                CREATE_INSTANT_INVITE: false
            });
            channel.overwritePermissions(user.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true,
                ATTACH_FILES: true
            });
            channel.overwritePermissions(rolePermitAll.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true,
                ATTACH_FILES: true
            });

            channel.setParent(parent.id);
            var initMessage = 0;

            var tempEmbed = new Discord.RichEmbed().setDescription("Please enter the discord tag for the seller\nFor example **user#0001**").setColor("#df79ff");
            await channel.send(tempEmbed);

            channel.awaitMessages(response => response.author.id === user.id, {
                    max: 1,
                    time: 300000,
                    errors: ['time'],
                })
                .then(async (collected) => {

                    try {
                        let enteredFix = collected.first().content.replace(/[\r\n]+/gm, "");
                        console.log(enteredFix);
                        let dName = enteredFix.substring(0, enteredFix.indexOf('#'));
                        console.log(dName);

                        let dId = enteredFix.substring(enteredFix.indexOf('#') + 1, enteredFix.length);
                        console.log(dId);
                        var partyId = await channel.guild.members.find(m => (m.user.username === dName && m.user.discriminator === dId)).user.id;

                        console.log(partyId);
                    } catch (ex) {
                        console.log(ex);
                        channel.send("Invalid tag or user is not in the server.");
                        var tempEmbed = new Discord.RichEmbed().setDescription("Please enter the discord tag for the seller\nFor example **user#0001**").setColor("#df79ff");
                        await channel.send(tempEmbed);

                        channel.awaitMessages(response => response.author.id === user.id, {
                                max: 1,
                                time: 300000,
                                errors: ['time'],
                            })
                            .then(async (collected) => {

                                try {
                                    let enteredFix = collected.first().content.replace(/[\r\n]+/gm, "");
                                    console.log(enteredFix);
                                    let dName = enteredFix.substring(0, enteredFix.indexOf('#'));
                                    console.log(dName);

                                    let dId = enteredFix.substring(enteredFix.indexOf('#') + 1, enteredFix.length);
                                    console.log(dId);
                                    var partyId = channel.guild.members.find(m => (m.user.username === dName && m.user.discriminator === dId)).user.id;
                                    console.log(partyId);
                                } catch (ex) {
                                    console.log(ex);
                                    channel.send("Invalid tag or user is not in the server.");
                                    var tempEmbed = new Discord.RichEmbed().setDescription("Please enter the discord tag for the seller\nFor example **user#0001**").setColor("#df79ff");
                                    await channel.send(tempEmbed);

                                    channel.awaitMessages(response => response.author.id === user.id, {
                                            max: 1,
                                            time: 300000,
                                            errors: ['time'],
                                        })
                                        .then(async (collected) => {

                                            try {
                                                let enteredFix = collected.first().content.replace(/[\r\n]+/gm, "");
                                                console.log(enteredFix);
                                                let dName = enteredFix.substring(0, enteredFix.indexOf('#'));
                                                console.log(dName);

                                                let dId = enteredFix.substring(enteredFix.indexOf('#') + 1, enteredFix.length);
                                                console.log(dId);
                                                var partyId = channel.guild.members.find(m => (m.user.username === dName && m.user.discriminator === dId)).user.id;
                                                console.log(partyId);
                                            } catch (ex) {
                                                console.log(ex);
                                                channel.send("Invalid tag or user is not in the server.");
                                                var tempEmbed = new Discord.RichEmbed().setDescription("Please enter the discord tag for the seller\nFor example **user#0001**").setColor("#df79ff");
                                                await channel.send(tempEmbed);

                                                channel.awaitMessages(response => response.author.id === user.id, {
                                                        max: 1,
                                                        time: 300000,
                                                        errors: ['time'],
                                                    })
                                                    .then(async (collected) => {

                                                        try {
                                                            let enteredFix = collected.first().content.replace(/[\r\n]+/gm, "");
                                                            console.log(enteredFix);
                                                            let dName = enteredFix.substring(0, enteredFix.indexOf('#'));
                                                            console.log(dName);

                                                            let dId = enteredFix.substring(enteredFix.indexOf('#') + 1, enteredFix.length);
                                                            console.log(dId);
                                                            var partyId = channel.guild.members.find(m => (m.user.username === dName && m.user.discriminator === dId)).user.id;
                                                            console.log(partyId);
                                                        } catch (ex) {
                                                            console.log(ex);
                                                            channel.send("Invalid tag or user is not in the server.");
                                                            var tempEmbed = new Discord.RichEmbed().setDescription("Please enter the discord tag for the seller\nFor example **user#0001**").setColor("#df79ff");
                                                            await channel.send(tempEmbed);

                                                            channel.awaitMessages(response => response.author.id === user.id, {
                                                                    max: 1,
                                                                    time: 300000,
                                                                    errors: ['time'],
                                                                })
                                                                .then(async (collected) => {

                                                                    try {
                                                                        let enteredFix = collected.first().content.replace(/[\r\n]+/gm, "");
                                                                        console.log(enteredFix);
                                                                        let dName = enteredFix.substring(0, enteredFix.indexOf('#'));
                                                                        console.log(dName);

                                                                        let dId = enteredFix.substring(enteredFix.indexOf('#') + 1, enteredFix.length);
                                                                        console.log(dId);
                                                                        var partyId = channel.guild.members.find(m => (m.user.username === dName && m.user.discriminator === dId)).user.id;
                                                                        console.log(partyId);
                                                                    } catch (ex) {
                                                                        console.log(ex);
                                                                        channel.send("Invalid tag or user is not in the server.")

                                                                    }

                                                                    let guild = channel.guild;
                                                                    if (guild.member(partyId)) {
                                                                        //user exists
                                                                        try {
                                                                            await Ticket.update({
                                                                                sellerID: partyId,
                                                                                status: 1
                                                                            }, {
                                                                                where: {
                                                                                    channelid: channel.id
                                                                                }
                                                                            });



                                                                            //command being used in valid channel -> add user -> send confirmation
                                                                            await channel.overwritePermissions(partyId, {
                                                                                VIEW_CHANNEL: true,
                                                                                SEND_MESSAGES: true
                                                                            });
                                                                            channel.send("User <@" + partyId + "> has been added!");

                                                                            channel.send("Hello <@" + partyId + ">");
                                                                            sendTotalEmbed(channel);

                                                                            added = true;




                                                                        } catch (ex) {
                                                                            console.log(ex);

                                                                        }


                                                                    }


                                                                    //await Ticket.update({ terms: collected.first().content }, { where: { channelid: channel.id } });

                                                                    //sendTotalEmbed(channel);
                                                                })

                                                        }

                                                        let guild = channel.guild;
                                                        if (guild.member(partyId)) {
                                                            //user exists
                                                            try {
                                                                await Ticket.update({
                                                                    sellerID: partyId,
                                                                    status: 1
                                                                }, {
                                                                    where: {
                                                                        channelid: channel.id
                                                                    }
                                                                });



                                                                //command being used in valid channel -> add user -> send confirmation
                                                                await channel.overwritePermissions(partyId, {
                                                                    VIEW_CHANNEL: true,
                                                                    SEND_MESSAGES: true
                                                                });
                                                                channel.send("User <@" + partyId + "> has been added!");

                                                                channel.send("Hello <@" + partyId + ">");
                                                                sendTotalEmbed(channel);

                                                                added = true;




                                                            } catch (ex) {
                                                                console.log(ex);

                                                            }


                                                        }


                                                        //await Ticket.update({ terms: collected.first().content }, { where: { channelid: channel.id } });

                                                        //sendTotalEmbed(channel);
                                                    })

                                            }

                                            let guild = channel.guild;
                                            if (guild.member(partyId)) {
                                                //user exists
                                                try {
                                                    await Ticket.update({
                                                        sellerID: partyId,
                                                        status: 1
                                                    }, {
                                                        where: {
                                                            channelid: channel.id
                                                        }
                                                    });



                                                    //command being used in valid channel -> add user -> send confirmation
                                                    await channel.overwritePermissions(partyId, {
                                                        VIEW_CHANNEL: true,
                                                        SEND_MESSAGES: true
                                                    });
                                                    channel.send("User <@" + partyId + "> has been added!");

                                                    channel.send("Hello <@" + partyId + ">");
                                                    sendTotalEmbed(channel);

                                                    added = true;




                                                } catch (ex) {
                                                    console.log(ex);

                                                }


                                            }


                                            //await Ticket.update({ terms: collected.first().content }, { where: { channelid: channel.id } });

                                            //sendTotalEmbed(channel);
                                        })

                                }

                                let guild = channel.guild;
                                if (guild.member(partyId)) {
                                    //user exists
                                    try {
                                        await Ticket.update({
                                            sellerID: partyId,
                                            status: 1
                                        }, {
                                            where: {
                                                channelid: channel.id
                                            }
                                        });



                                        //command being used in valid channel -> add user -> send confirmation
                                        await channel.overwritePermissions(partyId, {
                                            VIEW_CHANNEL: true,
                                            SEND_MESSAGES: true
                                        });
                                        channel.send("User <@" + partyId + "> has been added!");

                                        channel.send("Hello <@" + partyId + ">");
                                        sendTotalEmbed(channel);

                                        added = true;




                                    } catch (ex) {
                                        console.log(ex);

                                    }


                                }


                                //await Ticket.update({ terms: collected.first().content }, { where: { channelid: channel.id } });

                                //sendTotalEmbed(channel);
                            })

                    }

                    let guild = channel.guild;
                    if (guild.member(partyId)) {
                        //user exists
                        try {
                            await Ticket.update({
                                sellerID: partyId,
                                status: 1
                            }, {
                                where: {
                                    channelid: channel.id
                                }
                            });



                            //command being used in valid channel -> add user -> send confirmation
                            await channel.overwritePermissions(partyId, {
                                VIEW_CHANNEL: true,
                                SEND_MESSAGES: true
                            });
                            channel.send("User <@" + partyId + "> has been added!");

                            channel.send("Hello <@" + partyId + ">");
                            sendTotalEmbed(channel);

                            added = true;




                        } catch (ex) {
                            console.log(ex);

                        }


                    }


                    //await Ticket.update({ terms: collected.first().content }, { where: { channelid: channel.id } });

                    //sendTotalEmbed(channel);
                })
            //  channel.send(embeddedMessage).then(async sentMessage => {
            //await sentMessage.react("▶️"); //asda11
            //    initMessage = sentMessage;
            // });
            bot.on('messageReactionAdd', async (reaction, user) => {

                var message = reaction.message;
                if (!user.bot && message.id == initMessage.id) {
                    reaction.remove(user);
                }
                if (!user.bot && message.id == initMessage.id) {


                    if (reaction.emoji.name == "▶️") {
                        var checkValid = await Ticket.findOne({
                            where: {
                                channelid: message.channel.id
                            }
                        });

                        if (checkValid.sellerID != 0) {
                            message.channel.send("A Seller is already added!");
                            return;
                        }
                        var tempEmbed = new Discord.RichEmbed().setDescription("Please enter the discord tag for the seller\nFor example **user#0001**").setColor("#df79ff");
                        await channel.send(tempEmbed);

                        channel.awaitMessages(response => response.author.id === user.id, {
                                max: 1,
                                time: 300000,
                                errors: ['time'],
                            })
                            .then(async (collected) => {

                                try {
                                    let enteredFix = collected.first().content.replace(/[\r\n]+/gm, "");
                                    console.log(enteredFix);
                                    let dName = enteredFix.substring(0, enteredFix.indexOf('#'));
                                    console.log(dName);

                                    let dId = enteredFix.substring(enteredFix.indexOf('#') + 1, enteredFix.length);
                                    console.log(dId);
                                    var partyId = message.guild.members.find(m => (m.user.username === dName && m.user.discriminator === dId)).user.id;
                                    console.log(partyId);
                                } catch (ex) {
                                    message.channel.send("Invalid tag or user is not in the server.")
                                }

                                let guild = message.guild;
                                if (guild.member(partyId)) {
                                    //user exists
                                    try {
                                        await Ticket.update({
                                            sellerID: partyId,
                                            status: 1
                                        }, {
                                            where: {
                                                channelid: message.channel.id
                                            }
                                        });


                                        if (checkValid == undefined) {
                                            //command being used outside of valid channel
                                            message.channel.send("Escrow command cannot be used outside escrow channel!");
                                        } else {
                                            //command being used in valid channel -> add user -> send confirmation
                                            await message.channel.overwritePermissions(partyId, {
                                                VIEW_CHANNEL: true,
                                                SEND_MESSAGES: true
                                            });
                                            message.channel.send("User <@" + partyId + "> has been added!");

                                            message.channel.send("Hello <@" + partyId + ">");
                                            sendTotalEmbed(message.channel);

                                            added = true;


                                        }

                                    } catch (ex) {
                                        console.log(ex);

                                    }


                                }


                                //await Ticket.update({ terms: collected.first().content }, { where: { channelid: channel.id } });

                                //sendTotalEmbed(channel);
                            })

                    }



                }




            });


            let newTicket = await Ticket.create({
                buyerID: user.id,
                sellerID: '0',
                amount: 0,
                status: '0',
                channelid: channel.id
            });
            console.log("Ticket Saved...");
            let ticketId = String(newTicket.dataValues.id).padStart(4, "0");
            await channel.edit({
                name: `${channel.name}-${ticketId}`
            });
            init = true;

        }).catch(console.error);

    }
}
