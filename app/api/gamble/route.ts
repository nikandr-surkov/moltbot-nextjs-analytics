import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, globalState, bets } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

// AI Personality Generator
const generateAiResponse = (roll: number, isWin: boolean, profit: number) => {
  // Styles: 'success' (Green), 'error' (Red), 'jackpot' (Gold/Purple)
  
  if (roll === 100) {
    return {
      style: "jackpot",
      title: "CRITICAL HIT DETECTED",
      description: `System Overload! The vault has been breached. You secured $${profit.toLocaleString()}.`,
      emoji: "🎰",
      borderColor: "border-amber-400",
      textColor: "text-amber-300",
      bgColor: "bg-amber-900/40"
    };
  }

  if (isWin) {
    const winPhrases = [
      "Probability matrix aligned.",
      "Fortune favors the bold.",
      "Investment strategy: Successful.",
      "Algorithm approves this outcome.",
      "Neural network predicts more wins.",
      "Quantum fluctuation in your favor."
    ];
    return {
      style: "success",
      title: "WIN REGISTERED",
      description: `${winPhrases[Math.floor(Math.random() * winPhrases.length)]} Account credited +$${profit.toLocaleString()}.`,
      emoji: "🟢",
      borderColor: "border-green-500/50",
      textColor: "text-green-400",
      bgColor: "bg-green-900/30"
    };
  }

  // Loss
  const lossPhrases = [
    "Variance happens.",
    "The house sends its regards.",
    "System analysis: Unfortunate.",
    "Don't give up, human.",
    "Entropy increased.",
    "Risk assessment: Recalibrate.",
    "Statistical correction applied."
  ];
  return {
    style: "error",
    title: "LOSS CALCULATED",
    description: `${lossPhrases[Math.floor(Math.random() * lossPhrases.length)]} Vault absorbs $${Math.abs(profit).toLocaleString()}.`,
    emoji: "🔴",
    borderColor: "border-red-500/50",
    textColor: "text-red-400",
    bgColor: "bg-red-900/30"
  };
};

// GET: Fetch current game state (jackpot + recent wins)
export async function GET() {
  try {
    let jackpotState = await db.query.globalState.findFirst();
    
    if (!jackpotState) {
      const inserted = await db.insert(globalState).values({ jackpot: 1000 }).returning();
      jackpotState = inserted[0];
    }

    // Get last 5 winning bets for social proof
    const recentWins = await db.query.bets.findMany({
      where: eq(bets.isWin, true),
      orderBy: [desc(bets.createdAt)],
      limit: 5,
      with: {
        user: {
          columns: {
            firstName: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      jackpot: jackpotState.jackpot,
      recentWins: recentWins.map(bet => ({
        player: bet.user?.firstName || 'Anonymous',
        amount: bet.payout,
        roll: bet.roll,
        isJackpot: bet.roll === 100
      }))
    });

  } catch (error) {
    console.error('State Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Place a bet
export async function POST(req: NextRequest) {
  try {
    const { telegramId, betAmount } = await req.json();

    // Validate input
    if (!telegramId || typeof betAmount !== 'number' || betAmount <= 0 || !Number.isInteger(betAmount)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // 1. Get User and Jackpot
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    if (user.balance < betAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    let jackpotState = await db.query.globalState.findFirst();
    if (!jackpotState) {
      const inserted = await db.insert(globalState).values({ jackpot: 1000 }).returning();
      jackpotState = inserted[0];
    }

    // 2. Game Logic
    const roll = Math.floor(Math.random() * 100) + 1;
    let balanceChange = 0;
    let jackpotChange = 0;
    let payout = 0;
    let isWin = false;

    // WIN (51-99): 49% chance - Win 2x bet
    if (roll > 50 && roll < 100) {
      isWin = true;
      balanceChange = betAmount; // Net profit = bet amount (they get 2x back)
      payout = betAmount * 2;
      jackpotChange = -betAmount; // Jackpot pays the win
    } 
    // JACKPOT (100): 1% chance - Win 50% of jackpot + keep bet
    else if (roll === 100) {
      isWin = true;
      const jackpotWin = Math.floor(jackpotState.jackpot * 0.50);
      balanceChange = jackpotWin + betAmount; // FIX: Return bet + jackpot win
      payout = jackpotWin + betAmount;
      jackpotChange = -jackpotWin;
    }
    // LOSS (1-50): 50% chance - Lose bet
    else {
      isWin = false;
      balanceChange = -betAmount;
      payout = 0;
      jackpotChange = betAmount; // Lost bets feed the jackpot
    }

    // 3. DB Updates with balance re-check (prevent race condition overdraw)
    const updatedUser = await db.update(users)
      .set({ balance: sql`${users.balance} + ${balanceChange}` })
      .where(eq(users.telegramId, telegramId))
      .returning();

    // Verify balance didn't go negative (race condition protection)
    if (updatedUser[0].balance < 0) {
      // Rollback the balance change
      await db.update(users)
        .set({ balance: sql`${users.balance} - ${balanceChange}` })
        .where(eq(users.telegramId, telegramId));
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    await db.update(globalState)
      .set({ jackpot: sql`${globalState.jackpot} + ${jackpotChange}` })
      .where(eq(globalState.id, jackpotState.id));

    await db.insert(bets).values({
      userId: user.id,
      amount: betAmount,
      roll: roll,
      isWin: isWin,
      payout: payout
    });

    const finalJackpot = await db.query.globalState.findFirst();

    // 4. Generate AI Interaction Context
    const aiContext = generateAiResponse(roll, isWin, isWin ? balanceChange : betAmount);

    return NextResponse.json({
      success: true,
      roll,
      isWin,
      payout,
      profit: balanceChange,
      balance: updatedUser[0].balance,
      jackpot: finalJackpot?.jackpot || 1000,
      aiContext
    });

  } catch (error) {
    console.error('Gamble Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}