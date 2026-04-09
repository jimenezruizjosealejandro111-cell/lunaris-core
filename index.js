require('dotenv').config();

console.log("🔥 LUNARIS GOD + WEB + TICKETS 🔥");

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const {
    Client,
    GatewayIntentBits,
    Events,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

app.use(express.urlencoded({ extended: true }));

// =====================
// 🌐 WEB
// =====================
let sessions = {};

app.get('/', (req,res)=>{
    res.send(`<h1>🌙 Lunaris Online</h1><a href="/login">Login</a>`);
});

app.get('/login', (req,res)=>{
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

app.get('/callback', async (req,res)=>{

    const code = req.query.code;

    const data = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.REDIRECT_URI
    });

    const token = await fetch('https://discord.com/api/oauth2/token',{
        method:'POST',
        body:data,
        headers:{'Content-Type':'application/x-www-form-urlencoded'}
    });

    const tokenData = await token.json();

    const userRes = await fetch('https://discord.com/api/users/@me',{
        headers:{authorization:`Bearer ${tokenData.access_token}`}
    });

    const user = await userRes.json();

    sessions[user.id] = user;

    res.redirect(`/panel?user=${user.id}`);
});

app.get('/panel', (req,res)=>{

    const user = sessions[req.query.user];
    if(!user) return res.redirect('/login');

    res.send(`
    <h1>🌙 Lunaris Panel</h1>
    <p>${user.username}</p>
    `);
});

app.listen(process.env.PORT || 3000, "0.0.0.0");

// =====================
// 🤖 BOT
// =====================
const client = new Client({
    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, ()=>{
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// 💰 ECONOMÍA
// =====================
const workCD = new Map();

client.on(Events.MessageCreate, async msg=>{
    if(msg.author.bot) return;

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [msg.author.id, 0]);

    const cmd = msg.content;

    if(cmd === "!work"){
        if(workCD.has(msg.author.id) && Date.now() < workCD.get(msg.author.id))
            return msg.reply("⏳ cooldown");

        workCD.set(msg.author.id, Date.now() + 1800000);

        const money = Math.floor(Math.random()*100)+50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`,
            [money, msg.author.id]);

        msg.reply(`💼 +${money}`);
    }
});

// =====================
// 🎟️ TICKETS BOTÓN
// =====================
client.on(Events.InteractionCreate, async i=>{
    if(!i.isButton()) return;

    if(i.customId === "ticket"){
        const ch = await i.guild.channels.create({
            name:`ticket-${i.user.username}`,
            type:ChannelType.GuildText,
            permissionOverwrites:[
                {id:i.guild.roles.everyone,deny:["ViewChannel"]},
                {id:i.user.id,allow:["ViewChannel"]}
            ]
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setCustomId("close")
            .setLabel("Cerrar")
            .setStyle(ButtonStyle.Danger)
        );

        ch.send({content:`Ticket de ${i.user}`,components:[row]});
        i.reply({content:"Ticket creado",ephemeral:true});
    }

    if(i.customId === "close"){
        await i.channel.delete();
    }
});

// =====================
// ⚙️ SETUP COMPLETO
// =====================
client.on(Events.MessageCreate, async msg=>{

    if(msg.content !== "!setup lunaris") return;

    const g = msg.guild;

    // BORRAR TODO
    for(const ch of g.channels.cache.values()) try{await ch.delete()}catch{}
    for(const r of g.roles.cache.values()){
        if(r.name==="@everyone"||r.managed) continue;
        try{await r.delete()}catch{}
    }

    // ROLES
    const member = await g.roles.create({name:"👤 Miembro"});
    const admin = await g.roles.create({name:"💎 Admin"});

    // CATEGORÍAS
    const info = await g.channels.create({name:"📌 INFO",type:4});
    const general = await g.channels.create({name:"💬 GENERAL",type:4});
    const media = await g.channels.create({name:"📸 MEDIA",type:4});
    const games = await g.channels.create({name:"🎮 JUEGOS",type:4});
    const staff = await g.channels.create({name:"🛠 STAFF",type:4});

    // INFO
    await g.channels.create({name:"bienvenida",type:0,parent:info.id});
    await g.channels.create({name:"anuncios",type:0,parent:info.id});

    // GENERAL
    await g.channels.create({name:"general",type:0,parent:general.id});
    await g.channels.create({name:"economia",type:0,parent:general.id});
    await g.channels.create({name:"memes",type:0,parent:general.id});
    await g.channels.create({name:"eventos",type:0,parent:general.id});

    // MEDIA
    await g.channels.create({name:"fotos",type:0,parent:media.id});
    await g.channels.create({name:"clips",type:0,parent:media.id});

    // JUEGOS
    await g.channels.create({name:"valorant",type:0,parent:games.id});
    await g.channels.create({name:"minecraft",type:0,parent:games.id});
    await g.channels.create({name:"vrchat",type:0,parent:games.id});

    // STAFF
    const logs = await g.channels.create({name:"staff-logs",type:0,parent:staff.id});
    const tickets = await g.channels.create({name:"tickets",type:0,parent:staff.id});

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
        .setCustomId("ticket")
        .setLabel("🎟️ Crear Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    tickets.send({content:"Soporte",components:[row]});

    msg.reply("🔥 SETUP COMPLETO ULTRA");
});

client.login(process.env.TOKEN);