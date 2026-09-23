import cron from "node-cron";
import { Server } from "socket.io";
import { Client } from "@libsql/client";

export interface AgendaEventRow {
  id: number;
  title: string;
  event_date: string;
  event_time: string | null;
  event_type: "food" | "homework" | "exam" | "event";
  description: string | null;
  created_by: string;
  created_at: string;
}

// Track sent reminders to prevent duplicate notifications during the same minute window
const sentRemindersSet = new Set<string>();

/**
 * FMV Özel Işık Okulları 1-4. Sınıflar Öğle Yemeği Menüsü (23 - 30 Eylül 2026)
 */
export const FMV_ISIK_SEPTEMBER_LUNCH_MENU = [
  {
    event_date: "2026-09-23",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Tarhana Çorba\n• Etli Taze Fasülye\n• Kabak Dolma / Yoğurt\n• Peynirli Subörek\n• Makarna Büfesi (Beyaz Sebze Sos)\n• Salata Büfesi (Ton Balık)\n• Meyve Karpuz / Yoğurt"
  },
  {
    event_date: "2026-09-24",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Düğün Çorba\n• Hindi Rosto / Elma Dilim Patates\n• Sebzeli Misket Köfte\n• Tel Şehriyeli Pirinç Pilavı\n• Makarna Büfesi (Fesleğenli Domates Sos)\n• Salata Büfesi (Yoğurtlu Amerikan Salata)\n• Dondurma / Yoğurt"
  },
  {
    event_date: "2026-09-25",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Mercimek Çorba\n• Pilav Üzeri Et Döner\n• Blanjer Patates\n• Makarna Büfesi (Pesto Sos)\n• Salata Büfesi (Şakşuka)\n• Meyve Kavun / Ayran"
  },
  {
    event_date: "2026-09-28",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Kesme Sebze Çorba\n• Etli Kurufasülye\n• Kıymalı Sebze Graten\n• Pirinç Pilavı\n• Makarna Büfesi (Domates Sos)\n• Salata Büfesi (Havuç Tarator)\n• Meyve Kavun / Cacık"
  },
  {
    event_date: "2026-09-29",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Tarhana Çorba\n• İzmir Köfte\n• Çıtır Tavuk / Patates / Hindi Çıtır\n• Cevizli Erişte Kavurma\n• Makarna Büfesi (Fesleğenli Dom. Soslu)\n• Salata Büfesi (Zeytinyağlı Sebze Buketi)\n• Mürdüm Erik / Yoğurt"
  },
  {
    event_date: "2026-09-30",
    title: "Yemek Menüsü",
    event_type: "food" as const,
    description: "• Soğuk Ayran Aşı Çorba\n• Etli Türlü\n• Kıymalı Yeşil Mercimek\n• Bulgur Pilavı\n• Makarna Büfesi (Fesleğenli Dom. Soslu)\n• Salata Büfesi (Kabak Tarator)\n• Cevizli Baklava\n• Komposto (Vişne)"
  }
];

/**
 * FMV Özel Işık Okulları 1-4. Sınıflar Öğle Yemeği Menüsü (Ekim Ayı Hafta İçi Günleri)
 * Yalnızca Öğle Yemeği (Çorba, Ana Yemek, Garnitür/Pilav/Makarna, Tatlı/Salata/Yoğurt) kalemleri
 */
export const FMV_ISIK_OCTOBER_LUNCH_MENU = [
  // 1 Ekim Perşembe
  {
    day: 1,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Süzme Mercimek Çorbası\n• Fırında İzmir Köfte & Elma Dilim Patates\n• Şehriyeli Pirinç Pilavı\n• Mevsim Salata & Ayran"
  },
  // 2 Ekim Cuma
  {
    day: 2,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Kaşarlı Domates Çorbası\n• Fırında Çıtır Tavuk Baget\n• Sebzeli Bulgur Pilavı\n• Fırın Sütlaç"
  },
  // 5 Ekim Pazartesi
  {
    day: 5,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Yayla Çorbası\n• Etli Kuru Fasulye\n• Sade Pirinç Pilavı\n• Karışık Turşu & Yoğurt"
  },
  // 6 Ekim Salı
  {
    day: 6,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Ezogelin Çorbası\n• Kıymalı Sebzeli Musakka\n• Soslu Burgu Makarna\n• Taze Yoğurt"
  },
  // 7 Ekim Çarşamba
  {
    day: 7,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Kremalı Mantar Çorbası\n• Fırında Sebzeli Hindi Sote\n• Arpa Şehriyeli Pilav\n• Taze Mevsim Meyvesi"
  },
  // 8 Ekim Perşembe
  {
    day: 8,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Tarhana Çorbası\n• Kadınbudu Köfte & Patates Püresi\n• Domatesli Spagetti\n• Ev Yapımı İncir Tatlısı"
  },
  // 9 Ekim Cuma
  {
    day: 9,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Şifalı Sebze Çorbası\n• Fırında Çipura Fileto\n• Fırın Patates Dilimleri\n• Roka & Havuç Salatası / Tahin Helvası"
  },
  // 12 Ekim Pazartesi
  {
    day: 12,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Şehriye Çorbası\n• Kıymalı Karışık Dolma (Biber & Kabak)\n• Sarımsaklı / Sade Yoğurt\n• Kemalpaşa Tatlısı"
  },
  // 13 Ekim Salı
  {
    day: 13,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Kırmızı Mercimek Çorbası\n• Piliç Külbastı & Biberiyeli Sos\n• Havuçlu Pirinç Pilavı\n• Ayran"
  },
  // 14 Ekim Çarşamba
  {
    day: 14,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Tutmaç Çorbası\n• Tas Kebabı & Havuçlu Bezelye\n• Tereyağlı Bulgur Pilavı\n• Mevsim Çoban Salata"
  },
  // 15 Ekim Perşembe
  {
    day: 15,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Fırınlanmış Domates Çorbası\n• Izgara Kasap Köfte & Közlenmiş Biber\n• Fırın Peynirli Makarna\n• Çikolatalı Puding"
  },
  // 16 Ekim Cuma
  {
    day: 16,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Balkabağı Çorbası\n• Fırında Ispanaklı Tavuk Rulo\n• Sebzeli Kuskus\n• Üzüm Kompostosu"
  },
  // 19 Ekim Pazartesi
  {
    day: 19,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Ezogelin Çorbası\n• Etli Yeşil Mercimek Yemeği\n• Şehriyeli Pirinç Pilavı\n• Ev Yapımı Yoğurt"
  },
  // 20 Ekim Salı
  {
    day: 20,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Kremalı Tavuk Çorbası\n• Hasanpaşa Köfte & Patates Püresi\n• Kelebek Makarna\n• İrmik Helvası"
  },
  // 21 Ekim Çarşamba
  {
    day: 21,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Tel Şehriye Çorbası\n• Fırında Sebzeli Hindi But\n• Nohutlu Pirinç Pilavı\n• Naneli Cacık"
  },
  // 22 Ekim Perşembe
  {
    day: 22,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Yoğurtlu Buğday Çorbası\n• Orman Kebabı\n• Domatesli Bulgur Pilavı\n• Mevsim Meyvesi"
  },
  // 23 Ekim Cuma
  {
    day: 23,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Sebze Çorbası\n• Çıtır Balık Fileto & Tartar Sos\n• Fırınlanmış Patates\n• Akdeniz Yeşillikleri Salatası"
  },
  // 26 Ekim Pazartesi
  {
    day: 26,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Mercimek Çorbası\n• Kıymalı Karnabahar Graten\n• Domates Soslu Kalem Makarna\n• Yoğurt"
  },
  // 27 Ekim Salı
  {
    day: 27,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Yayla Çorbası\n• Piliç Şinitzel\n• Mısırlı Pirinç Pilavı\n• Çoban Salata & Ayran"
  },
  // 28 Ekim Çarşamba
  {
    day: 28,
    title: "Günün Öğle Yemeği Menüsü (Cumhuriyet Özel Menüsü)",
    description: "• Düğün Çorbası\n• Hünkar Beğendi (Dana Etli)\n• Tereyağlı Pirinç Pilavı\n• Trileçe Tatlısı"
  },
  // 30 Ekim Cuma
  {
    day: 30,
    title: "Günün Öğle Yemeği Menüsü",
    description: "• Domates Çorbası\n• Fırında Köfte Patates\n• Cevizli Erişte\n• Meyve / Ayran"
  }
];

export async function initAgendaTable(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS agenda_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_time TEXT,
    event_type TEXT NOT NULL,
    description TEXT,
    created_by TEXT DEFAULT 'emirgan',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_agenda_events_date ON agenda_events(event_date)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_agenda_events_type ON agenda_events(event_type)`);
  } catch (e) {}
}

export async function seedOctoberLunchMenu(client: Client) {
  try {
    const currentYear = new Date().getFullYear();
    const yearsToSeed = [2026, 2028, currentYear];
    const uniqueYears = Array.from(new Set(yearsToSeed));

    // 1. Seed September Menu (23 - 30 September) with clean overwrite
    for (const item of FMV_ISIK_SEPTEMBER_LUNCH_MENU) {
      await client.execute({
        sql: "DELETE FROM agenda_events WHERE event_date = ? AND event_type = 'food'",
        args: [item.event_date]
      });
      await client.execute({
        sql: `INSERT INTO agenda_events (title, event_date, event_time, event_type, description, created_by)
              VALUES (?, ?, '12:30', 'food', ?, 'emirgan')`,
        args: [item.title, item.event_date, item.description]
      });
    }

    // 2. Seed October Menu
    for (const yr of uniqueYears) {
      const existing = await client.execute({
        sql: "SELECT COUNT(*) as cnt FROM agenda_events WHERE event_date LIKE ? AND event_type = 'food'",
        args: [`${yr}-10-%`]
      });

      const count = Number(existing.rows[0]?.cnt || 0);
      if (count === 0) {
        console.log(`[Agenda] Seeding FMV Özel Işık Okulları October Lunch Menu for year ${yr}...`);
        for (const item of FMV_ISIK_OCTOBER_LUNCH_MENU) {
          const dateStr = `${yr}-10-${String(item.day).padStart(2, "0")}`;
          await client.execute({
            sql: `INSERT INTO agenda_events (title, event_date, event_time, event_type, description, created_by)
                  VALUES (?, ?, '12:30', 'food', ?, 'emirgan')`,
            args: [item.title, dateStr, item.description]
          });
        }
      }
    }
  } catch (err) {
    console.error("[Agenda] Error seeding lunch menu:", err);
  }
}

/**
 * Node-Cron Scheduler: Runs every minute.
 * If an event with event_time is approaching in exactly 60 or 15 minutes,
 * dispatches automated real-time reminder toast via Socket.io and logs a notification in the database.
 */
export function startAgendaCronJobs(client: Client, io: Server) {
  console.log("[Agenda] Starting minute-interval Cron job for event reminders...");

  // Run at the beginning of every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      // Format current date as YYYY-MM-DD
      const dateStr = now.toISOString().split("T")[0];
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentTotalMin = currentHour * 60 + currentMin;

      // Query today's events that have a defined time
      const res = await client.execute({
        sql: "SELECT * FROM agenda_events WHERE event_date = ? AND event_time IS NOT NULL AND event_time != ''",
        args: [dateStr]
      });

      for (const row of res.rows) {
        const ev = row as any as AgendaEventRow;
        if (!ev.event_time) continue;

        const [hStr, mStr] = ev.event_time.split(":");
        const eventH = parseInt(hStr, 10);
        const eventM = parseInt(mStr, 10);
        if (isNaN(eventH) || isNaN(eventM)) continue;

        const eventTotalMin = eventH * 60 + eventM;
        const diffMin = eventTotalMin - currentTotalMin;

        // Check for 60-minute or 15-minute reminders
        if (diffMin === 60 || diffMin === 15) {
          const reminderKey = `${ev.id}_${dateStr}_${diffMin}min`;
          if (!sentRemindersSet.has(reminderKey)) {
            sentRemindersSet.add(reminderKey);

            const timeLabel = diffMin === 60 ? "1 saat" : "15 dakika";
            const notificationContent = `⏰ Yaklaşan Etkinlik: "${ev.title}" ${timeLabel} sonra (${ev.event_time}) başlıyor!`;

            console.log(`[Agenda Cron] Triggering ${timeLabel} reminder for event: ${ev.title}`);

            // 1. Broadcast real-time Toast via Socket.io
            io.emit("new_toast", {
              title: "⏰ Yaklaşan Etkinlik",
              body: `"${ev.title}" ${timeLabel} sonra başlıyor!`,
              type: ev.event_type === "exam" ? "error" : "info",
              targetTab: "agenda"
            });

            // 2. Broadcast agenda reminder event
            io.emit("agenda_reminder", {
              event: ev,
              minutesLeft: diffMin,
              message: notificationContent
            });

            // 3. Save to global notifications table so it appears in users' Bildirimler tab
            try {
              const allUsers = await client.execute("SELECT id FROM users");
              const nowIso = new Date().toISOString();
              for (const u of allUsers.rows) {
                await client.execute({
                  sql: "INSERT INTO notifications (user_id, type, content, read, created_at) VALUES (?, 'agenda_reminder', ?, 0, ?)",
                  args: [u.id, notificationContent, nowIso]
                }).catch(() => {});
              }
              io.emit("notifications_updated");
            } catch (notifErr) {
              console.error("[Agenda Cron] Error saving notifications to DB:", notifErr);
            }
          }
        }
      }

      // Cleanup old keys at midnight
      if (currentHour === 0 && currentMin === 0) {
        sentRemindersSet.clear();
      }
    } catch (cronErr) {
      console.error("[Agenda Cron] Error running agenda check:", cronErr);
    }
  });
}
