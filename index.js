require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, Events, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// =====================
// EXPRESS (RAILWAY)
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("🚀 Lunaris Core activo");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web activa en puerto ${PORT}`);
});

// =====================
// DATABASE
// =====================
const db = new sqlite3.Database('./warns.db');

// WARNS
db.run(`CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    userTag TEXT,
    reason TEXT,
    date TEXT
)`);

// ECONOMY
db.run(`CREATE TABLE IF NOT EXISTS economy (
    userId TEXT PRIMARY KEY,
    balance INTEGER
)`);

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
// EMBED FACTORY PRO
// =====================
function createLogEmbed({ title, color, user, moderator, reason, extra, message }) {
    const embed = new EmbedBuilder()
        .setAuthor({
            name: "Lunaris Moderation",
            iconURL: message.guild.iconURL()
        })
        .setTitle(title)
        .setColor(color)
        .setFooter({
            text: "Lunaris Core • Sistema de Logs",
            iconURL: message.client.user.displayAvatarURL()
        })
        .setTimestamp();

    if (user) {
        embed.setThumbnail(user.displayAvatarURL());
        embed.addFields({ name: "👤 Usuario", value: `${user}`, inline: true });
    }

    if (moderator) {
        embed.addFields({ name: "👮 Moderador", value: `${moderator}`, inline: true });
    }

    if (reason) {
        embed.addFields({ name: "📝 Razón", value: reason });
    }

    if (extra) {
        embed.addFields(extra);
    }

    return embed;
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
    // ECONOMY
    // =====================
    if (command === '!balance') {
        getUser(message.author.id, (data) => {
            message.reply(`💰 Tienes: ${data.balance} monedas`);
        });
    }

    if (command === '!work') {
        const amount = Math.floor(Math.random() * 100) + 50;

        getUser(message.author.id, () => {
            updateBalance(message.author.id, amount);
        });

        message.reply(`💼 Ganaste ${amount} monedas`);
    }

    if (command === '!daily') {
        const amount = 200;

        getUser(message.author.id, () => {
            updateBalance(message.author.id, amount);
        });

        message.reply(`🎁 Daily recibido: ${amount}`);
    }

    if (command === '!give') {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user || !amount) return message.reply("Uso: !give @user cantidad");

        getUser(message.author.id, (data) => {
            if (data.balance < amount) {
                return message.reply("❌ No tienes suficiente dinero");
            }

            updateBalance(message.author.id, -amount);
            updateBalance(user.id, amount);

            message.reply(`💸 Transferiste ${amount} a ${user.tag}`);
        });
    }

    // =====================
    // MODERACIÓN
    // =====================

    if (command === '!clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ No tienes permisos');
        }

        const amount = parseInt(args[1]);
        if (!amount) return message.reply('⚠️ Escribe un número');

        await message.channel.bulkDelete(amount, true);

        const embed = createLogEmbed({
            title: "🧹 Limpieza de Mensajes",
            color: "#8e44ad",
            moderator: message.author,
            extra: [
                { name: "📦 Cantidad", value: `${amount}`, inline: true },
                { name: "📍 Canal", value: `${message.channel}`, inline: true }
            ],
            message
        });

        logChannel.send({ embeds: [embed] });
    }

    if (command === '!warn') {
        const user = message.mentions.users.first();
        const reason = args.slice(2).join(' ') || "Sin razón";

        db.run(
            `INSERT INTO warns (userId, userTag, reason, date) VALUES (?, ?, ?, ?)`,
            [user.id, user.tag, reason, new Date().toLocaleString()]
        );

        const embed = createLogEmbed({
            title: "⚠️ Advertencia",
            color: "#f39c12",
            user,
            moderator: message.author,
            reason,
            message
        });

        logChannel.send({ embeds: [embed] });
    }

    if (command === '!ban') {
        const user = message.mentions.members.first();
        const reason = args.slice(2).join(' ') || "Sin razón";

        await user.ban({ reason });

        const embed = createLogEmbed({
            title: "🔨 Usuario Baneado",
            color: "#e74c3c",
            user: user.user,
            moderator: message.author,
            reason,
            message
        });

        logChannel.send({ embeds: [embed] });
    }

    if (command === '!kick') {
        const user = message.mentions.members.first();
        const reason = args.slice(2).join(' ') || "Sin razón";

        await user.kick(reason);

        const embed = createLogEmbed({
            title: "👢 Usuario Expulsado",
            color: "#c0392b",
            user: user.user,
            moderator: message.author,
            reason,
            message
        });

        logChannel.send({ embeds: [embed] });
    }

    if (command === '!mute') {
        const user = message.mentions.members.first();

        await user.timeout(10 * 60 * 1000);

        const embed = createLogEmbed({
            title: "🔇 Usuario Silenciado",
            color: "#7f8c8d",
            user: user.user,
            moderator: message.author,
            message
        });

        logChannel.send({ embeds: [embed] });
    }

    if (command === '!unmute') {
        const user = message.mentions.members.first();

        await user.timeout(null);

        const embed = createLogEmbed({
            title: "🔊 Usuario Desmuteado",
            color: "#2ecc71",
            user: user.user,
            moderator: message.author,
            message
        });

        logChannel.send({ embeds: [embed] });
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);