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
// DISCORD CLIENT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} online`);
});

// =====================
// COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

    // 🔥 LOG CHANNEL FIX DEFINITIVO
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

        const embed = new EmbedBuilder()
            .setTitle('🧹 CLEAR')
            .setColor('Purple')
            .addFields(
                { name: '👮 Admin', value: message.author.tag },
                { name: '📦 Cantidad', value: `${amount}` },
                { name: '📍 Canal', value: message.channel.name }
            )
            .setTimestamp();

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

        const embed = new EmbedBuilder()
            .setTitle('⚠️ WARN')
            .setColor('Orange')
            .addFields(
                { name: '👤 Usuario', value: user.tag },
                { name: '👮 Admin', value: message.author.tag },
                { name: '📝 Razón', value: reason }
            )
            .setTimestamp();

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

        const embed = new EmbedBuilder()
            .setTitle('🔨 BAN')
            .setColor('Red')
            .addFields(
                { name: '👤 Usuario', value: user.user.tag },
                { name: '👮 Admin', value: message.author.tag },
                { name: '📝 Razón', value: reason }
            )
            .setTimestamp();

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

        const embed = new EmbedBuilder()
            .setTitle('👢 KICK')
            .setColor('DarkRed')
            .addFields(
                { name: '👤 Usuario', value: user.user.tag },
                { name: '👮 Admin', value: message.author.tag },
                { name: '📝 Razón', value: reason }
            )
            .setTimestamp();

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

        const embed = new EmbedBuilder()
            .setTitle('🔇 MUTE')
            .setColor('Grey')
            .addFields(
                { name: '👤 Usuario', value: user.user.tag },
                { name: '👮 Admin', value: message.author.tag }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);