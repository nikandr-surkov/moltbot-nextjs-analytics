import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// 1. Validate Telegram Data Integrity
function verifyTelegramWebAppData(initData: string): any {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  // Sort keys alphabetically
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create Secret Key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  // Calculate Hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return null;
  }

  return JSON.parse(urlParams.get('user') || '{}');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initData } = body;

    // Validate
    const telegramUser = verifyTelegramWebAppData(initData);

    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 401 });
    }

    const telegramId = telegramUser.id.toString();

    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });

    if (!user) {
      // Create new user
      const newUserResult = await db.insert(users).values({
        telegramId,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        languageCode: telegramUser.language_code,
        isPremium: telegramUser.is_premium || false,
      }).returning();
      
      user = newUserResult[0];
    }

    return NextResponse.json({ user });

  } catch (error) {
    console.error('Auth Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}