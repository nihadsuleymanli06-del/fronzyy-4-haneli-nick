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

// Yetkili kişinin ID'si (Bulunan 4 haneli nick buraya DM olarak gönderilir)
const OWNER_ID = '1184518857679962186';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789_';
const checkedNicks = new Set();
let activeTimer = null;
let isPausedByRateLimit = false;

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

async function notifyOwnerDM(nick, infoText) {
  if (!OWNER_ID) return;
  try {
    const owner = await client.users.fetch(OWNER_ID);
    if (owner) {
      await owner.send(
        `🎉 **4 Haneli Nick Bulundu!**\n` +
        `🏷️ **Nick:** \`${nick}\`\n` +
        `📌 **Detay:** ${infoText}`
      );
    }
  } catch (err) {
    console.error('DM gönderme hatası:', err.message);
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
        new TextDisplayBuilder().setContent('• 4 haneli (4 karakterli) uygun kullanıcı adlarını hızlıca tarar, boşta olan nick yakaladığı an size **DM üzerinden** haber verir ve isterseniz hesaba otomatik uygular.')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## **Nasıl Kullanılır?**')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('• **▶️ Başlat** : Butona basın, token, arama hızı (saniye) ve otomatik koyma tercihini girerek hızlı 4 haneli nick aramasını başlatın. Nick bulunduğunda bot size DM atar.')
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
  if (interaction.isButton() && interaction.customId === 'start_nick') {
    const modal = new ModalBuilder()
      .setCustomId('nick_start_modal')
      .setTitle('Hızlı 4 Haneli Nick Arama');

    const accountTokenInput = new TextInputBuilder()
      .setCustomId('target_token')
      .setLabel('Hesap Tokeni')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const intervalInput = new TextInputBuilder()
      .setCustomId('interval_sec')
      .setLabel('Kaç saniyede bir hızlı aransın? (örn: 1.5)')
      .setValue('1.5')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const autoSetInput = new TextInputBuilder()
      .setCustomId('auto_set')
      .setLabel('Bulunan nicki hesaba da koysun mu? (evet/hayır)')
      .setValue('hayır')
      .setPlaceholder('evet veya hayır')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(accountTokenInput),
      new ActionRowBuilder().addComponents(intervalInput),
      new ActionRowBuilder().addComponents(autoSetInput)
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'nick_start_modal') {
    const targetToken = interaction.fields.getTextInputValue('target_token').trim();
    const intervalSec = parseFloat(interaction.fields.getTextInputValue('interval_sec'));
    const autoSetRaw = interaction.fields.getTextInputValue('auto_set').trim().toLowerCase();
    const autoSet = autoSetRaw === 'evet' || autoSetRaw === 'yes' || autoSetRaw === 'true';

    if (isNaN(intervalSec) || intervalSec < 0.3) {
      return interaction.reply({ content: '❌ Lütfen en az 0.3 saniye veya daha yüksek geçerli bir süre girin!', ephemeral: true });
    }

    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    isPausedByRateLimit = false;

    await interaction.reply({
      content: `▶️ Hızlı **4 Haneli Nick** araması başlatıldı! (Hız: **${intervalSec}s**, Otomatik Koy: **${autoSet ? 'Evet' : 'Hayır'}**) — Bulunca DM'den bildirilecek.`,
      ephemeral: true
    });

    activeTimer = setInterval(async () => {
      if (isPausedByRateLimit) return;

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
          console.log(`[BULUNDU] 4 haneli nick: ${candidate}`);
          await notifyOwnerDM(
            candidate,
            autoSet
              ? 'Boşta olan 4 haneli nick bulundu ve hesaba uygulandı. Arama durduruldu.'
              : 'Boşta olan 4 haneli nick bulundu ve DM ile bildirildi. Arama durduruldu.'
          );
          clearInterval(activeTimer);
          activeTimer = null;
        } else if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          const waitSec = Math.max(2, Math.ceil(Number(data.retry_after) || 5));
          isPausedByRateLimit = true;
          console.warn(`[RATE LIMIT] ${waitSec}s bekleniyor...`);

          setTimeout(() => {
            isPausedByRateLimit = false;
          }, waitSec * 1000);
        } else {
          const errData = await res.json().catch(() => ({}));
          const rawErr = JSON.stringify(errData).toLowerCase();
          if (!rawErr.includes('username')) {
            console.log(`[KONTROL] ${candidate} | Durum: ${res.status}`);
          }
        }
      } catch (err) {
        console.error('Nick kontrol hatası:', err.message);
      }
    }, intervalSec * 1000);
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ HATA: DISCORD_TOKEN environment değişkeni bulunamadı!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
