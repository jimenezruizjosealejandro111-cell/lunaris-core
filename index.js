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

// ================= CANVAS =================
const { createCanvas, loadImage } = require("canvas");

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

// ================= ANTI RAID =================
let joinTracker = new Map();
let antiRaidActive = false;

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

  // PANEL ANUNCIOS
  if (i.isButton() && i.customId === "crear_anuncio") {

    const modal = new ModalBuilder()
      .setCustomId("modal_anuncio")
      .setTitle("📢 Crear anuncio");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("titulo").setLabel("Título").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("mensaje").setLabel("Mensaje").setStyle(TextInputStyle.Paragraph)
      )
    );

    await i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === "modal_anuncio") {

    const canal = i.guild.channels.cache.find(c => c.name.includes("anuncios"));

    canal?.send({
      content: "@everyone",
      embeds: [
        new EmbedBuilder()
          .setColor("#7a00ff")
          .setTitle(i.fields.getTextInputValue("titulo"))
          .setDescription(i.fields.getTextInputValue("mensaje"))
      ]
    });

    i.reply({ content: "✅ Anuncio enviado", ephemeral: true });
  }
});

// ================= PANEL =================
client.on("messageCreate", async msg => {

  if (msg.content === "!panel-anuncios") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("crear_anuncio")
        .setLabel("📢 Crear anuncio")
        .setStyle(ButtonStyle.Primary)
    );

    msg.channel.send({
      embeds: [new EmbedBuilder().setTitle("Panel de anuncios")],
      components: [row]
    });
  }
});

// ================= BIENVENIDA + ANTI RAID =================
client.on("guildMemberAdd", async member => {

  const logs = member.guild.channels.cache.find(c => c.name.includes("staff-logs"));
  const welcome = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));

  // ANTI RAID
  const now = Date.now();
  const guildId = member.guild.id;

  if (!joinTracker.has(guildId)) joinTracker.set(guildId, []);
  const joins = joinTracker.get(guildId);

  joins.push(now);
  const recent = joins.filter(t => now - t < 10000);
  joinTracker.set(guildId, recent);

  if (recent.length >= 5 && !antiRaidActive) {
    antiRaidActive = true;

    logs?.send({
      embeds: [new EmbedBuilder().setColor("Red").setTitle("🚨 ANTI RAID")]
    });

    setTimeout(() => antiRaidActive = false, 60000);
  }

  // AUTOROL
  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);

  // CANVAS
  const canvas = createCanvas(1024, 500);
  const ctx = canvas.getContext("2d");

  const background = await loadImage("https://cdn.discordapp.com/attachments/1495637775716978688/1495812926047518740/diana-y-leona.png");
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 50px sans-serif";
  ctx.fillText("BIENVENIDO", 350, 150);

  ctx.font = "40px sans-serif";
  ctx.fillText(member.user.username, 350, 220);

  const avatar = await loadImage(member.user.displayAvatarURL({ extension: "png" }));

  ctx.beginPath();
  ctx.arc(150, 250, 100, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(avatar, 50, 150, 200, 200);

  const attachment = {
    files: [{ attachment: canvas.toBuffer(), name: "welcome.png" }]
  };

  welcome?.send({
    content: `👋 ${member}`,
    embeds: [new EmbedBuilder().setImage("attachment://welcome.png")],
    files: attachment.files
  });

  logs?.send({
    embeds: [new EmbedBuilder().setColor("Green").setTitle("Usuario entró")]
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
        .setTitle("Mensaje eliminado")
        .setDescription(m.content || "Sin texto")
    ]
  });
});

client.login(process.env.TOKEN);
