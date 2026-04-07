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

db.run(`CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    userTag TEXT,
    reason TEXT,
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
// FUNCTIONS
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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} online`);
});

// =====================
// AUTO ROLE + WELCOME
// =====================
client.on(Events.GuildMemberAdd, async (member) => {
    const roleId = "1480379455271600360";
    const welcomeChannelId = "1480384374611378176";
    const logChannelId = "1480726976984518839";

    try {
        await member.roles.add(roleId);

        const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId);
        const logChannel = await member.guild.channels.fetch(logChannelId);

        const welcomeEmbed = new EmbedBuilder()
            .setTitle("🌙 Bienvenido a Lunaris")
            .setDescription(`✨ Bienvenido ${member} a **${member.guild.name}**`)
            .setColor("#9b59b6")
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        welcomeChannel.send({ embeds: [welcomeEmbed] });

        const logEmbed = new EmbedBuilder()
            .setTitle("📥 Nuevo miembro")
            .setColor("#00ffcc")
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: "👤 Usuario", value: `${member.user.tag}` },
                { name: "🆔 ID", value: `${member.user.id}` }
            )
            .setTimestamp();

        logChannel.send({ embeds: [logEmbed] });

    } catch (err) {
        console.log(err);
    }
});

// =====================
// COMMANDS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

    const logChannel = await message.client.channels.fetch("1480726976984518839");

    // BALANCE
    if (command === '!balance') {
        getUser(message.author.id, (data) => {
            message.reply(`💰 ${data.balance} monedas`);
        });
    }

    // WORK 20 MIN
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

        getUser(userId, () => {
            updateBalance(userId, amount);
        });

        message.reply(`💼 Ganaste ${amount}`);
    }

    // DAILY
    if (command === '!daily') {
        const amount = 200;

        getUser(message.author.id, () => {
            updateBalance(message.author.id, amount);
        });

        message.reply(`🎁 Daily: ${amount}`);
    }

    // SHOP
    if (command === '!shop') {
        message.reply("🛒 VRChat Plus — 5000 monedas");
    }

    // BUY
    if (command === '!buy') {
        const price = 5000;

        getUser(message.author.id, (data) => {
            if (data.balance < price) {
                return message.reply("❌ No tienes dinero");
            }

            updateBalance(message.author.id, -price);

            message.reply("🛒 Compraste VRChat Plus");

            logChannel.send(`🛒 ${message.author.tag} compró VRChat Plus`);
        });
    }

    // WARN AUTO
    if (command === '!warn') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("⚠️ menciona a alguien");

        db.run(
            `INSERT INTO warns (userId, userTag, reason, date) VALUES (?, ?, ?, ?)`,
            [member.id, member.user.tag, "Warn", new Date().toLocaleString()]
        );

        db.all(`SELECT * FROM warns WHERE userId = ?`, [member.id], async (err, rows) => {
            const total = rows.length;

            message.reply(`⚠️ ${member.user.tag} tiene ${total} warns`);

            if (total === 3) {
                await member.timeout(600000);
                message.channel.send("🔇 Mute automático");
            }

            if (total >= 10) {
                await member.ban();
                db.run(`DELETE FROM warns WHERE userId = ?`, [member.id]);
                message.channel.send("🔨 Ban automático");
            }
        });
    }

    // CLEAR
    if (command === '!clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        await message.channel.bulkDelete(amount, true);

        logChannel.send(`🧹 ${amount} mensajes borrados`);
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);