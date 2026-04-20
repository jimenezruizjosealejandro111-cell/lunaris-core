require("dotenv").config();

// ================= WEB =================
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("🌙 Lunaris Core Online"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// ================= DISCORD =================
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require("discord.js");

// ================= DATABASE =================
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./economy.db");

db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, coins INTEGER DEFAULT 0)`);

function getCoins(id) {
  return new Promise(res => {
    db.get("SELECT coins FROM users WHERE id=?", [id], (e, r) => {
      if (!r) {
        db.run("INSERT INTO users (id, coins) VALUES (?,0)", [id]);
        return res(0);
      }
      res(r.coins);
    });
  });
}

function addCoins(id, amount) {
  db.run(`
    INSERT INTO users (id, coins)
    VALUES (?,?)
    ON CONFLICT(id) DO UPDATE SET coins = coins + ?
  `, [id, amount, amount]);
}

// ================= BOT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldowns = new Map();

// ================= READY =================
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} ONLINE`);

  const commands = [
    new SlashCommandBuilder().setName("work").setDescription("Trabajar"),
    new SlashCommandBuilder().setName("balance").setDescription("Ver dinero"),
    new SlashCommandBuilder().setName("daily").setDescription("Recompensa diaria")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async i => {

  // ===== ECONOMÍA =====
  if (i.isChatInputCommand()) {

    const user = i.user.id;

    if (i.commandName === "work") {
      const now = Date.now();
      const last = cooldowns.get(user) || 0;

      if (now - last < 1800000)
        return i.reply({ content: "⏳ Espera 30 min", ephemeral: true });

      const money = Math.floor(Math.random() * 200) + 50;
      addCoins(user, money);
      cooldowns.set(user, now);

      return i.reply(`💼 Ganaste ${money}`);
    }

    if (i.commandName === "balance") {
      const coins = await getCoins(user);
      return i.reply(`💰 ${coins} coins`);
    }

    if (i.commandName === "daily") {
      addCoins(user, 500);
      return i.reply("🎁 +500 coins");
    }
  }

  // ===== PANEL BOTÓN =====
  if (i.isButton() && i.customId === "crear_anuncio") {

    if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return i.reply({ content: "❌ No tienes permiso", ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId("modal_anuncio_pro")
      .setTitle("📢 Crear anuncio");

    const titulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título")
      .setStyle(TextInputStyle.Short);

    const mensaje = new TextInputBuilder()
      .setCustomId("mensaje")
      .setLabel("Mensaje")
      .setStyle(TextInputStyle.Paragraph);

    const imagen = new TextInputBuilder()
      .setCustomId("imagen")
      .setLabel("URL Imagen (opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(mensaje),
      new ActionRowBuilder().addComponents(imagen)
    );

    await i.showModal(modal);
  }

  // ===== MODAL =====
  if (i.isModalSubmit() && i.customId === "modal_anuncio_pro") {

    const titulo = i.fields.getTextInputValue("titulo");
    const mensaje = i.fields.getTextInputValue("mensaje");
    const imagen = i.fields.getTextInputValue("imagen");

    const canal = i.guild.channels.cache.find(c => c.name.includes("anuncios"));

    const embed = new EmbedBuilder()
      .setColor("#7a00ff")
      .setTitle(`📢 ${titulo}`)
      .setDescription(mensaje)
      .setFooter({ text: `Lunaris • ${i.user.tag}` })
      .setTimestamp();

    if (imagen) embed.setImage(imagen);

    canal?.send({
      content: "@everyone",
      embeds: [embed]
    });

    i.reply({ content: "✅ Anuncio enviado", ephemeral: true });
  }
});

// ================= PANEL COMANDO =================
client.on("messageCreate", async msg => {

  if (msg.content === "!panel-anuncios") {

    if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return msg.reply("❌ No tienes permiso");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("crear_anuncio")
        .setLabel("📢 Crear Anuncio")
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setColor("#7a00ff")
      .setTitle("📢 Panel de Anuncios")
      .setDescription("Usa el botón para crear anuncios");

    msg.channel.send({ embeds: [embed], components: [row] });
  }

  // ===== SETUP =====
  if (msg.content === "!setup") {

    const g = msg.guild;

    await msg.reply("⚙️ Configurando servidor...");

    for (const ch of g.channels.cache.values()) {
      try { await ch.delete(); } catch {}
    }

    for (const r of g.roles.cache.values()) {
      if (r.name !== "@everyone") {
        try { await r.delete(); } catch {}
      }
    }

    const owner = await g.roles.create({
      name: "👑 Owner",
      permissions: [PermissionsBitField.Flags.Administrator]
    });

    const member = await g.roles.create({ name: "👤 Miembro" });

    await msg.member.roles.add(owner);

    const info = await g.channels.create({ name: "📌 INFO", type: ChannelType.GuildCategory });
    const general = await g.channels.create({ name: "💬 GENERAL", type: ChannelType.GuildCategory });
    const staff = await g.channels.create({ name: "🛠 STAFF", type: ChannelType.GuildCategory });

    await g.channels.create({ name: "📢・bienvenida", parent: info.id });
    await g.channels.create({ name: "📢・anuncios", parent: info.id });

    await g.channels.create({
      name: "📜・staff-logs",
      parent: staff.id,
      permissionOverwrites: [
        { id: g.roles.everyone, deny: ["ViewChannel"] },
        { id: owner.id, allow: ["ViewChannel"] }
      ]
    });

    msg.channel.send("🔥 SETUP COMPLETO");
  }
});

// ================= BIENVENIDA =================
client.on("guildMemberAdd", async member => {

  const welcome = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));
  const logs = member.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setAuthor({
      name: `Bienvenido a ${member.guild.name}`,
      iconURL: member.guild.iconURL()
    })
    .setDescription(`✨ ${member} se unió al servidor`)
    .setThumbnail(member.user.displayAvatarURL())
    .setImage("https://i.imgur.com/8Km9tLL.png")
    .setTimestamp();

  welcome?.send({ content: `👋 ${member}`, embeds: [embed] });

  logs?.send({
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle("📥 Member Joined")
        .setDescription(member.user.tag)
    ]
  });
});

// ================= LOGS =================
client.on("messageDelete", async m => {
  if (!m.guild || m.author?.bot) return;

  const logs = m.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  logs?.send({
    embeds: [
      new EmbedBuilder()
        .setColor("Red")
        .setTitle("🗑️ Mensaje eliminado")
        .setDescription(`${m.author.tag}: ${m.content || "Sin texto"}`)
    ]
  });
});

client.on("guildMemberRemove", async member => {
  const logs = member.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  logs?.send({
    embeds: [
      new EmbedBuilder()
        .setColor("Orange")
        .setTitle("📤 Member Left")
        .setDescription(member.user.tag)
    ]
  });
});

client.login(process.env.TOKEN);
