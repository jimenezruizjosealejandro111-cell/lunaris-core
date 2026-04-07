require('dotenv').config();

// 🔥 EVITA CRASH
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

const express = require('express');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// =====================
// EXPRESS (WEB)
// =====================
const app = express();

// 🔥 SOLO UNA RUTA "/" (IMPORTANTE)
app.get('/', (req, res) => {
    res.send(`
    <html>
    <head>
        <title>Lunaris Dashboard</title>
        <style>
            body {
                background: #0f0f1a;
                color: white;
                font-family: Arial;
                text-align: center;
                padding: 50px;
            }
            .card {
                background: #1e1e2f;
                padding: 20px;
                border-radius: 10px;
                margin: 10px;
                display: inline-block;
            }
        </style>
    </head>
    <body>

        <h1>🌙 Lunaris Dashboard</h1>

        <div class="card">
            <h2>🤖 Estado</h2>
            <p>Online</p>
        </div>

        <div class="card">
            <h2>💰 Sistema</h2>
            <p>Economía activa</p>
        </div>

    </body>
    </html>
    `);
});

// TEST
app.get('/ping', (req, res) => {
    res.send("pong");
});

// 🔥 PUERTO DINÁMICO (CLAVE EN RAILWAY)
// Railway asigna el puerto automáticamente :contentReference[oaicite:0]{index=0}
const PORT = process.env.PORT || 3000;

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

// =====================
// CONFIG
// =====================
const LOG_CHANNEL = "1480726976984518839";
const WELCOME_CHANNEL = "1480384374611378176";
const AUTO_ROLE = "1480379455271600360";

// =====================
// COOLDOWN
// =====================
const cooldowns = new Map();

// =====================
// FUNCIONES
// =====================
function getUser(userId, callback) {
    db.get(`SELECT * FROM economy WHERE userId = ?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO economy (userId, balance) VALUES (?, ?)`, [userId, 0]);
            return callback({ balance: 0 });
        }
        callback(row);
    });
}

function addMoney(userId, amount) {
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
// AUTO ROL + BIENVENIDA
// =====================
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        await member.roles.add(AUTO_ROLE);

        const welcome = await member.guild.channels.fetch(WELCOME_CHANNEL);
        const logs = await member.guild.channels.fetch(LOG_CHANNEL);

        welcome.send(`🌙 Bienvenido ${member}`);

        logs.send(`📥 ${member.user.tag} entró al servidor`);
    } catch (err) {
        console.log(err);
    }
});

// =====================
// LOGS MENSAJES
// =====================
client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guild || msg.author?.bot) return;

    const logs = await msg.guild.channels.fetch(LOG_CHANNEL);

    logs.send(`🗑️ ${msg.author.tag} borró mensaje: ${msg.content}`);
});

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const logs = await oldMsg.guild.channels.fetch(LOG_CHANNEL);

    logs.send(`✏️ ${oldMsg.author.tag} editó mensaje`);
});

// =====================
// COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const cmd = message.content.toLowerCase();

    // BALANCE
    if (cmd === '!balance') {
        getUser(message.author.id, (data) => {
            message.reply(`💰 Tienes ${data.balance} monedas`);
        });
    }

    // WORK (20 MIN)
    if (cmd === '!work') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldown = 20 * 60 * 1000;

        if (cooldowns.has(userId)) {
            const time = cooldowns.get(userId) + cooldown;

            if (now < time) {
                const left = ((time - now) / 60000).toFixed(1);
                return message.reply(`⏳ Espera ${left} minutos`);
            }
        }

        cooldowns.set(userId, now);

        const money = Math.floor(Math.random() * 100) + 50;

        getUser(userId, () => addMoney(userId, money));

        message.reply(`💼 Ganaste ${money} monedas`);
    }

    // CLEAR
    if (cmd.startsWith('!clear')) {
        const args = cmd.split(' ');
        const amount = parseInt(args[1]);

        if (!amount) return;

        await message.channel.bulkDelete(amount);

        message.reply(`🧹 ${amount} mensajes eliminados`);
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);