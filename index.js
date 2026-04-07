require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, Events, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// =====================
// EXPRESS
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("🚀 Lunaris Core activo");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web activa`);
});

// =====================
// DATABASE
// =====================
const db = new sqlite3.Database('./data.db');

// ECONOMY
db.run(`CREATE TABLE IF NOT EXISTS economy (
    userId TEXT PRIMARY KEY,
    balance INTEGER
)`);

// PURCHASES
db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    item TEXT,
    price INTEGER,
    date TEXT
)`);

// =====================
// COOLDOWNS
// =====================
const cooldowns = {
    work: new Map(),
    daily: new Map()
};

// =====================
// ECONOMY FUNCTIONS
// =====================
function getUser(userId, callback) {
    db.get(`SELECT * FROM economy WHERE userId = ?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO economy (userId, balance) VALUES (?, ?)`, [userId, 0]);
            return callback({ userId, balance: 0 });
        }
        callback(row);
    });
}

function updateBalance(userId, amount) {
    db.run(`UPDATE economy SET balance = balance + ? WHERE userId = ?`, [amount, userId]);
}

// =====================
// CLIENT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================
// EMBED
// =====================
function createEmbed(title, color, fields, message, user) {
    return new EmbedBuilder()
        .setAuthor({
            name: "Lunaris System",
            iconURL: message.guild.iconURL()
        })
        .setTitle(title)
        .setColor(color)
        .setThumbnail(user?.displayAvatarURL())
        .addFields(fields)
        .setFooter({
            text: "Lunaris Core",
            iconURL: message.client.user.displayAvatarURL()
        })
        .setTimestamp();
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} online`);
});

// =====================
// COMMANDS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

    const logChannel = await message.client.channels.fetch("1480726976984518839");

    // =====================
    // BALANCE
    // =====================
    if (command === '!balance') {
        getUser(message.author.id, (data) => {
            message.reply(`💰 Tienes: ${data.balance} monedas`);
        });
    }

    // =====================
    // WORK (COOLDOWN)
    // =====================
    if (command === '!work') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldown = 60 * 1000;

        if (cooldowns.work.has(userId)) {
            const expiration = cooldowns.work.get(userId) + cooldown;

            if (now < expiration) {
                const timeLeft = ((expiration - now) / 1000).toFixed(0);
                return message.reply(`⏳ Espera ${timeLeft}s`);
            }
        }

        cooldowns.work.set(userId, now);

        const amount = Math.floor(Math.random() * 100) + 50;

        getUser(userId, () => {
            updateBalance(userId, amount);
        });

        message.reply(`💼 Ganaste ${amount} monedas`);
    }

    // =====================
    // DAILY (COOLDOWN)
    // =====================
    if (command === '!daily') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;

        if (cooldowns.daily.has(userId)) {
            const expiration = cooldowns.daily.get(userId) + cooldown;

            if (now < expiration) {
                const timeLeft = ((expiration - now) / 1000 / 60).toFixed(1);
                return message.reply(`⏳ Vuelve en ${timeLeft} min`);
            }
        }

        cooldowns.daily.set(userId, now);

        const amount = 200;

        getUser(userId, () => {
            updateBalance(userId, amount);
        });

        message.reply(`🎁 Daily: ${amount}`);
    }

    // =====================
    // SHOP
    // =====================
    if (command === '!shop') {
        const embed = createEmbed(
            "🛒 Tienda Lunaris",
            "#9b59b6",
            [
                { name: "🌟 VRChat Plus (1 mes)", value: "💰 5000 monedas" }
            ],
            message
        );

        message.reply({ embeds: [embed] });
    }

    // =====================
    // BUY
    // =====================
    if (command === '!buy') {
        const price = 5000;

        getUser(message.author.id, (data) => {
            if (data.balance < price) {
                return message.reply("❌ No tienes suficientes monedas");
            }

            updateBalance(message.author.id, -price);

            db.run(
                `INSERT INTO purchases (userId, item, price, date) VALUES (?, ?, ?, ?)`,
                [message.author.id, "VRChat Plus (1 mes)", price, new Date().toLocaleString()]
            );

            message.reply("🛒 Compraste VRChat Plus");

            const embed = createEmbed(
                "🛒 Compra",
                "#00ffcc",
                [
                    { name: "👤 Usuario", value: `${message.author}` },
                    { name: "🎁 Producto", value: "VRChat Plus" },
                    { name: "💰 Precio", value: `${price}` }
                ],
                message,
                message.author
            );

            logChannel.send({ embeds: [embed] });
        });
    }

    // =====================
    // CLEAR
    // =====================
    if (command === '!clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        await message.channel.bulkDelete(amount, true);

        const embed = createEmbed(
            "🧹 Limpieza",
            "#8e44ad",
            [
                { name: "👮 Admin", value: `${message.author}` },
                { name: "📦 Cantidad", value: `${amount}` }
            ],
            message,
            message.author
        );

        logChannel.send({ embeds: [embed] });
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);