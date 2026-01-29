import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { telegramId } = await req.json();

    if (!telegramId) {
      return NextResponse.json({ error: 'Missing telegramId' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check cooldown (24 hours)
    const now = new Date();
    const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null;
    const oneDay = 24 * 60 * 60 * 1000;

    if (lastClaim && (now.getTime() - lastClaim.getTime() < oneDay)) {
      const timeLeft = Math.ceil((oneDay - (now.getTime() - lastClaim.getTime())) / (1000 * 60 * 60));
      return NextResponse.json({ error: `Please wait ${timeLeft} hours` }, { status: 400 });
    }

    // Update user balance and claim time
    const updatedUser = await db.update(users)
      .set({
        balance: sql`${users.balance} + 100`,
        lastDailyClaim: new Date(),
      })
      .where(eq(users.telegramId, telegramId))
      .returning();

    return NextResponse.json({ 
      success: true, 
      balance: updatedUser[0].balance,
      message: "Claimed $100!" 
    });

  } catch (error) {
    console.error('Daily Claim Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}