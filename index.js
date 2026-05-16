// ============================================
// 🌙 LUNARIS CORE - INDEX COMPLETO
// Moderación + Economía + Logs + Bienvenidas
// ============================================

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ============================================
// DATABASE
// ============================================

const db = new sqlite3.Database("./economy.db");

db.run(`
CREATE TABLE IF NOT EXISTS economy (
  userId TEXT PRIMARY KEY,
  coins INTEGER DEFAULT 0
)
`);

// ============================================
// CONFIG
// ============================================

const PREFIX = "!";
const LOG_CHANNEL_NAME = "staff-logs";
const WELCOME_CHANNEL_NAME = "bienvenida";

// ============================================
// BOT READY
// ============================================

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} encendido`);

  // ============================================
  // SLASH COMMANDS
  // ============================================

  const commands = [

    // CLEAR
    new SlashCommandBuilder()
      .setName("clear")
      .setDescription("🧹 Borra mensajes")
      .addIntegerOption(option =>
        option
          .setName("cantidad")
          .setDescription("Cantidad de mensajes")
          .setRequired(true)
      ),

    // BAN
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("🔨 Banear usuario")
      .addUserOption(option =>
        option
          .setName("usuario")
          .setDescription("Usuario")
          .setRequired(true)
      ),

    // KICK
    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("👢 Expulsar usuario")
      .addUserOption(option =>
        option
          .setName("usuario")
          .setDescription("Usuario")
          .setRequired(true)
      ),

    // WARN
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("⚠️ Advertir usuario")
      .addUserOption(option =>
        option
          .setName("usuario")
          .setDescription("Usuario")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("razon")
          .setDescription("Razón")
          .setRequired(true)
      ),

    // BALANCE
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("💰 Ver monedas"),

    // DAILY
    new SlashCommandBuilder()
      .setName("daily")
      .setDescription("🎁 Reclamar recompensa diaria")

  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Slash commands cargados");
  } catch (err) {
    console.log(err);
  }
});

// ============================================
// BIENVENIDAS
// ============================================

client.on("guildMemberAdd", async member => {

  const channel = member.guild.channels.cache.find(
    c => c.name.includes(WELCOME_CHANNEL_NAME)
  );

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#a855f7")
    .setTitle("🌙 Bienvenido a Lunaris")
    .setDescription(
      `✨ ${member} se unió al servidor\n\n📖 Lee las reglas y disfruta tu estadía`
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setImage("https://cdn.discordapp.com/attachments/1495637775716978688/1495812926047518740/diana-y-leona.png")
    .setFooter({
      text: `Miembro #${member.guild.memberCount}`
    });

  channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });

  // LOGS

  const logs = member.guild.channels.cache.find(
    c => c.name.includes(LOG_CHANNEL_NAME)
  );

  if (logs) {

    const logEmbed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("📥 Usuario entró")
      .setDescription(`${member.user.tag} entró al servidor`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    logs.send({
      embeds: [logEmbed],
      allowedMentions: { parse: [] }
    });
  }
});

// ============================================
// MESSAGE DELETE LOGS
// ============================================

client.on("messageDelete", async message => {

  if (!message.guild) return;
  if (message.author?.bot) return;

  const logs = message.guild.channels.cache.find(
    c => c.name.includes(LOG_CHANNEL_NAME)
  );

  if (!logs) return;

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🗑️ Mensaje eliminado")
    .addFields(
      {
        name: "👤 Usuario",
        value: `${message.author.tag}`,
        inline: true
      },
      {
        name: "📍 Canal",
        value: `${message.channel}`,
        inline: true
      },
      {
        name: "💬 Contenido",
        value: message.content || "Sin texto"
      }
    )
    .setTimestamp();

  logs.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });
});

// ============================================
// SLASH COMMANDS
// ============================================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // ============================================
  // CLEAR
  // ============================================

  if (interaction.commandName === "clear") {

    if (!interaction.member.permissions.has(
      PermissionsBitField.Flags.ManageMessages
    )) {
      return interaction.reply({
        content: "❌ No tienes permisos",
        ephemeral: true
      });
    }

    const amount = interaction.options.getInteger("cantidad");

    if (amount < 1 || amount > 100) {
      return interaction.reply({
        content: "❌ Debe ser entre 1 y 100",
        ephemeral: true
      });
    }

    await interaction.channel.bulkDelete(amount, true);

    interaction.reply({
      content: `🧹 ${amount} mensajes eliminados`,
      ephemeral: true
    });

    const logs = interaction.guild.channels.cache.find(
      c => c.name.includes(LOG_CHANNEL_NAME)
    );

    if (logs) {

      const embed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("🧹 Clear ejecutado")
        .setDescription(
          `${interaction.user.tag} borró ${amount} mensajes en ${interaction.channel}`
        )
        .setTimestamp();

      logs.send({
        embeds: [embed],
        allowedMentions: { parse: [] }
      });
    }
  }

  // ============================================
  // BAN
  // ============================================

  if (interaction.commandName === "ban") {

    if (!interaction.member.permissions.has(
      PermissionsBitField.Flags.BanMembers
    )) {
      return interaction.reply({
        content: "❌ No tienes permisos",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("usuario");
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({
        content: "❌ Usuario no encontrado",
        ephemeral: true
      });
    }

    await member.ban();

    interaction.reply({
      content: `🔨 ${user.tag} fue baneado`
    });
  }

  // ============================================
  // KICK
  // ============================================

  if (interaction.commandName === "kick") {

    if (!interaction.member.permissions.has(
      PermissionsBitField.Flags.KickMembers
    )) {
      return interaction.reply({
        content: "❌ No tienes permisos",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("usuario");
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({
        content: "❌ Usuario no encontrado",
        ephemeral: true
      });
    }

    await member.kick();

    interaction.reply({
      content: `👢 ${user.tag} fue expulsado`
    });
  }

  // ============================================
  // WARN
  // ============================================

  if (interaction.commandName === "warn") {

    const user = interaction.options.getUser("usuario");
    const razon = interaction.options.getString("razon");

    const embed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("⚠️ Advertencia")
      .setDescription(`${user} fue advertido`)
      .addFields({
        name: "📄 Razón",
        value: razon
      });

    interaction.reply({
      embeds: [embed]
    });
  }

  // ============================================
  // BALANCE
  // ============================================

  if (interaction.commandName === "balance") {

    db.get(
      `SELECT * FROM economy WHERE userId = ?`,
      [interaction.user.id],
      (err, row) => {

        const coins = row ? row.coins : 0;

        interaction.reply({
          content: `💰 Tienes ${coins} monedas`
        });
      }
    );
  }

  // ============================================
  // DAILY
  // ============================================

  if (interaction.commandName === "daily") {

    const amount = 500;

    db.get(
      `SELECT * FROM economy WHERE userId = ?`,
      [interaction.user.id],
      (err, row) => {

        if (!row) {

          db.run(
            `INSERT INTO economy (userId, coins) VALUES (?, ?)`,
            [interaction.user.id, amount]
          );

        } else {

          db.run(
            `UPDATE economy SET coins = coins + ? WHERE userId = ?`,
            [amount, interaction.user.id]
          );
        }

        interaction.reply({
          content: `🎁 Recibiste ${amount} monedas`
        });
      }
    );
  }
});

// ============================================
// ANTI SPAM SIMPLE
// ============================================

const spamMap = new Map();

client.on("messageCreate", message => {

  if (message.author.bot) return;

  const data = spamMap.get(message.author.id);

  if (!data) {
    spamMap.set(message.author.id, {
      count: 1,
      time: Date.now()
    });

  } else {

    data.count++;

    if (data.count >= 6) {

      message.delete().catch(() => {});

      message.channel.send({
        content: `⚠️ ${message.author} spam detectado`,
        allowedMentions: { parse: [] }
      });

      spamMap.delete(message.author.id);
    }

    setTimeout(() => {
      spamMap.delete(message.author.id);
    }, 5000);
  }
});

// ============================================
// LOGIN
// ============================================

client.login(process.env.TOKEN);
