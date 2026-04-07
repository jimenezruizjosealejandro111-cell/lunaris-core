require('dotenv').config();

const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Events } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

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
// READY (ACTUALIZADO)
// =====================
client.once(Events.ClientReady, () => {
    console.log(`🚀 ${client.user.tag} online`);
});

// =====================
// EVENTS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

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

        const logChannel = message.guild.channels.cache.find(c => c.name === "logs");

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🧹 Clear ejecutado')
                .addFields(
                    { name: 'Usuario', value: message.author.tag },
                    { name: 'Cantidad', value: `${amount}` },
                    { name: 'Canal', value: `${message.channel}` }
                )
                .setColor('Purple');

            logChannel.send({ embeds: [embed] });
        }
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

        const logChannel = message.guild.channels.cache.find(c => c.name === "logs");

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Warn')
                .addFields(
                    { name: 'Usuario', value: user.tag },
                    { name: 'Moderador', value: message.author.tag },
                    { name: 'Razón', value: reason }
                )
                .setColor('Orange');

            logChannel.send({ embeds: [embed] });
        }
    }

    // =====================
    // WARNS
    // =====================
    if (command === '!warns') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        db.all(`SELECT * FROM warns WHERE userId = ?`, [user.id], (err, rows) => {
            if (!rows || rows.length === 0) {
                return message.reply('✅ Este usuario no tiene warns');
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Warns de ${user.tag}`)
                .setColor('Blue');

            rows.forEach(w => {
                embed.addFields({
                    name: w.date,
                    value: w.reason
                });
            });

            message.channel.send({ embeds: [embed] });
        });
    }

    // =====================
    // CLEAR WARNS
    // =====================
    if (command === '!clearwarns') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Sin permisos');
        }

        const user = message.mentions.users.first();
        if (!user) return message.reply('⚠️ Menciona a alguien');

        db.run(`DELETE FROM warns WHERE userId = ?`, [user.id]);

        message.reply(`🧹 Warns de ${user.tag} eliminados`);
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);