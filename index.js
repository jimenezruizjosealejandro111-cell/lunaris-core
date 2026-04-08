require('dotenv').config();

// 🔥 EVITA CRASHES SILENCIOSOS
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

const express = require('express');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// =====================
// EXPRESS (WEB)
// =====================
const app = express();

// 🔥 RESPUESTA RÁPIDA (CLAVE PARA RAILWAY)
app.get('/', (req, res) => {
    res.status(200).send("🌙 Lunaris Core ONLINE ✅");
});

// 🔥 PING TEST
app.get('/ping', (req, res) => {
    res.send("pong");
});

// 🔥 PUERTO DINÁMICO + FALLBACK
const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web activa en puerto ${PORT}`);
});

// =====================
// DATABASE
// =====================
const db = new sqlite3.Database('./data.db');

db.run(`CREATE TABLE IF NOT EXISTS economy (
    userId TEXT PRIMARY KEY,
    balance INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    item TEXT,
    price INTEGER,
    date TEXT
)`);

// =====================
// CONFIG
// =====================
const LOG_CHANNEL = "1480726976984518839";
const WELCOME_CHANNEL = "1480384374611378176";
const AUTO_ROLE = "1480379455271600360";

// =====================
// COOLDOWNS
// =====================
const cooldowns = {
    work: new Map()
};

// =====================
// FUNCIONES
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
// DISCORD BOT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} online`);
});

// =====================
// AUTO ROLE + BIENVENIDA
// =====================
client.on(Events.GuildMemberAdd, async (member) => {
    const welcomeChannel = await member.guild.channels.fetch(WELCOME_CHANNEL);
    const logChannel = await member.guild.channels.fetch(LOG_CHANNEL);

    await member.roles.add(AUTO_ROLE);

    welcomeChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("🌙 Bienvenido a Lunaris")
                .setDescription(`✨ ${member} se unió al servidor`)
                .setColor("#9b59b6")
                .setThumbnail(member.user.displayAvatarURL())
        ]
    });

    logChannel.send(`📥 ${member.user.tag} entró al servidor`);
});

// =====================
// LOG MENSAJES
// =====================
client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;

    const logChannel = await message.guild.channels.fetch(LOG_CHANNEL);

    logChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("🗑️ Mensaje eliminado")
                .setColor("#e74c3c")
                .addFields(
                    { name: "Usuario", value: message.author.tag },
                    { name: "Canal", value: `${message.channel}` },
                    { name: "Contenido", value: message.content || "Vacío" }
                )
        ]
    });
});

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const logChannel = await oldMsg.guild.channels.fetch(LOG_CHANNEL);

    logChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("✏️ Mensaje editado")
                .setColor("#f1c40f")
                .addFields(
                    { name: "Usuario", value: oldMsg.author.tag },
                    { name: "Antes", value: oldMsg.content || "Vacío" },
                    { name: "Después", value: newMsg.content || "Vacío" }
                )
        ]
    });
});

// =====================
// COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const command = message.content.split(' ')[0];
    const logChannel = await message.client.channels.fetch(LOG_CHANNEL);

    // 💰 BALANCE
    if (command === '!balance') {
        getUser(message.author.id, (data) => {
            message.reply(`💰 Tienes ${data.balance} monedas`);
        });
    }

    // 💼 WORK (20 MIN)
    if (command === '!work') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldown = 20 * 60 * 1000;

        if (cooldowns.work.has(userId)) {
            const expiration = cooldowns.work.get(userId) + cooldown;

            if (now < expiration) {
                const timeLeft = ((expiration - now) / 1000 / 60).toFixed(1);
                return message.reply(`⏳ Espera ${timeLeft} minutos`);
            }
        }

        cooldowns.work.set(userId, now);

        const amount = Math.floor(Math.random() * 100) + 50;

        getUser(userId, () => updateBalance(userId, amount));

        message.reply(`💼 Ganaste ${amount} monedas`);
    }

    // 🛒 SHOP
    if (command === '!shop') {
        message.reply("🛒 VRChat Plus → 5000 monedas");
    }

    // 💳 BUY
    if (command === '!buy') {
        const price = 5000;

        getUser(message.author.id, (data) => {
            if (data.balance < price) return message.reply("❌ No tienes suficiente dinero");

            updateBalance(message.author.id, -price);

            db.run(
                `INSERT INTO purchases (userId, item, price, date) VALUES (?, ?, ?, ?)`,
                [message.author.id, "VRChat Plus", price, new Date().toISOString()]
            );

            message.reply("✅ Compraste VRChat Plus");

            logChannel.send(`🛒 ${message.author.tag} compró VRChat Plus`);
        });
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);