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

db.run(`CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    userTag TEXT,
    reason TEXT,
    date TEXT
)`);

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
    // CLEAR
    // =====================
    if (command === '!clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ No tienes permisos');
        }

        const amount = parseInt(args[1]);
        if (!amount) return message.reply('⚠️ Escribe un número');

        await message.channel.bulkDelete(amount, true);
        message.reply(`🧹 ${amount} mensajes eliminados`);

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

    // =====================
    // WARN
    // =====================
    if (command === '!warn') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Sin permisos');
        }

        const user = message.mentions.users.first();
        const reason = args.slice(2).join(' ') || "Sin razón";

        if (!user) return message.reply('⚠️ Menciona a alguien');

        db.run(
            `INSERT INTO warns (userId, userTag, reason, date) VALUES (?, ?, ?, ?)`,
            [user.id, user.tag, reason, new Date().toLocaleString()]
        );

        message.reply(`⚠️ ${user.tag} fue advertido`);

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

    // =====================
    // BAN
    // =====================
    if (command === '!ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ No tienes permisos');
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        const reason = args.slice(2).join(' ') || "Sin razón";

        await user.ban({ reason });
        message.reply(`🔨 ${user.user.tag} fue baneado`);

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

    // =====================
    // KICK
    // =====================
    if (command === '!kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply('❌ No tienes permisos');
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        const reason = args.slice(2).join(' ') || "Sin razón";

        await user.kick(reason);
        message.reply(`👢 ${user.user.tag} fue expulsado`);

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

    // =====================
    // MUTE
    // =====================
    if (command === '!mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Sin permisos');
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        await user.timeout(10 * 60 * 1000);
        message.reply(`🔇 ${user.user.tag} silenciado`);

        const embed = createLogEmbed({
            title: "🔇 Usuario Silenciado",
            color: "#7f8c8d",
            user: user.user,
            moderator: message.author,
            message
        });

        logChannel.send({ embeds: [embed] });
    }

    // =====================
    // UNMUTE
    // =====================
    if (command === '!unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Sin permisos');
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        await user.timeout(null);
        message.reply(`🔊 ${user.user.tag} desmuteado`);

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