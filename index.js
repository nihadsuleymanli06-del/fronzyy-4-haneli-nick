import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
} from 'discord.js';
import express from 'express';

// --- UPTIME VE PORT İÇİN EXPRESS SUNUCUSU ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Fronzyy 4 Haneli Nick Botu aktif ve çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`Express sunucusu ${PORT} portunda çalışıyor.`);
});
// -------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Paneli açabilecek yetkili kullanıcı ID'si
const OWNER_ID = '1184518857679962186';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789_';
const checkedNicks = new Set();
let activeTimer = null;
let isPausedByRateLimit = false;
let attemptCount = 0;

function generate4CharNick() {
  for (let i = 0; i < 50; i++) {
    let result = '';
    for (let j = 0; j < 4; j++) {
      result += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    if (!checkedNicks.has(result)) {
      checkedNicks.add(result);
      return result;
    }
  }
  checkedNicks.clear();
  let fallback = '';
  for (let j = 0; j < 4; j++) {
    fallback += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return fallback;
}

async function sendChannelStatus(channel, text) {
  if (!channel) return;
  try {
    await channel.send(text);
  } catch (err) {
    console.error('Kanal mesajı gönderme hatası:', err.message);
  }
}

client.once('ready', () => {
  console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);

  client.user.setActivity({
    name: 'powered by Fronzyy',
    type: ActivityType.Playing
  });
});

// !panel-nick komutu
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!panel-nick' || message.content === '!panel-spam') {
    if (message.author.id !== OWNER_ID) {
      try {
        await message.delete();
      } catch (e) {}

      try {
        const warningMsg = await message.channel.send({
          content: `❌ <@${message.author.id}> Bu komutu sadece yönetici kullanabilir.`
        });

        setTimeout(async () => {
          try { await warningMsg.delete(); } catch (err) {}
        }, 5000);
      } catch (err) {}

      return;
    }

    try { await message.delete(); } catch (e) {}

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# **Fronzyy 4 Haneli Nick Botu**')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## **Ne İşe Yarar?**')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• 4 haneli (4 karakterli) uygun kullanıcı adlarını arar ve denenen nickleri kanalda `gj_a ❌` formatında gösterir; uygun nick bulunduğunda kanalda bildirir.')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## **Nasıl Kullanılır?**')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **▶️ Başlat** : Butona tıklayın, token ve arama aralığını (en az 2 saniye) girin. Denenen nickler bu kanala yazılır.')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# Copyright © Developed by Fronzyy 2026')
      );

    // Sadece ▶️ Başlat butonu
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_nick')
        .setLabel('Başlat')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️')
    );

    await message.channel.send({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2
    });
  }
});

// Buton ve Modal etkileşimleri
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === 'start_nick') {
      const modal = new ModalBuilder()
        .setCustomId('nick_start_modal')
        .setTitle('4 Haneli Nick Arama');

      const accountTokenInput = new TextInputBuilder()
        .setCustomId('target_token')
        .setLabel('Kontrol İçin Hesap Tokeni')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const intervalInput = new TextInputBuilder()
        .setCustomId('interval_sec')
        .setLabel('Kaç saniyede bir aransın? (en az 2)')
        .setValue('2.5')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(accountTokenInput),
        new ActionRowBuilder().addComponents(intervalInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'nick_start_modal') {
      const targetChannel = interaction.channel;
      const targetToken = interaction.fields.getTextInputValue('target_token').trim();
      const intervalSec = parseFloat(interaction.fields.getTextInputValue('interval_sec'));

      if (isNaN(intervalSec) || intervalSec < 2) {
        await interaction.reply({
          content: '❌ Lütfen en az 2 saniye veya daha yüksek geçerli bir süre girin!',
          ephemeral: true
        });
        return;
      }

      if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
      }
      isPausedByRateLimit = false;
      attemptCount = 0;

      await interaction.reply({
        content: `▶️ **4 Haneli Nick** araması başlatıldı! (Aralık: **${intervalSec}s**) — Denenen nickler kanala yazılacak.`,
        ephemeral: true
      });

      activeTimer = setInterval(async () => {
        if (isPausedByRateLimit) return;

        attemptCount += 1;
        const candidate = generate4CharNick();

        try {
          const res = await fetch('https://discord.com/api/v9/users/@me', {
            method: 'PATCH',
            headers: {
              'Authorization': targetToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: candidate })
          });

          if (res.status === 200) {
            console.log(`[BULUNDU] #${attemptCount} | ${candidate} ✅`);
            await sendChannelStatus(targetChannel, `${candidate} ✅`);
            clearInterval(activeTimer);
            activeTimer = null;
          } else if (res.status === 429) {
            const data = await res.json().catch(() => ({}));
            const waitSec = Math.max(3, Math.ceil(Number(data.retry_after) || 5));
            isPausedByRateLimit = true;
            console.warn(`[RATE LIMIT] #${attemptCount} | ${waitSec}s bekleniyor...`);
            await sendChannelStatus(targetChannel, `⏳ Rate limit (${waitSec}s bekleniyor)...`);

            setTimeout(() => {
              isPausedByRateLimit = false;
            }, waitSec * 1000);
          } else {
            await res.json().catch(() => ({}));
            console.log(`[DENENDİ] #${attemptCount} | ${candidate} ❌ | HTTP: ${res.status}`);
            await sendChannelStatus(targetChannel, `${candidate} ❌`);
          }
        } catch (err) {
          console.error(`[HATA] #${attemptCount} | Nick kontrol hatası:`, err.message);
          await sendChannelStatus(targetChannel, `${candidate} ❌`);
        }
      }, intervalSec * 1000);
    }
  } catch (err) {
    console.error('Interaction hatası:', err);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: '❌ İşlem sırasında bir hata oluştu.', ephemeral: true });
      } catch (e) {}
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ HATA: DISCORD_TOKEN environment değişkeni bulunamadı!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
