import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const MOLTBOT_SECRET = process.env.MOLTBOT_SECRET;

export async function POST(req: NextRequest) {
    try {
        // 1. Security: Check Secret Key
        const authHeader = req.headers.get('x-moltbot-secret');
        if (!MOLTBOT_SECRET || authHeader !== MOLTBOT_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Validate Query
        const body = await req.json();
        let { query } = body;
        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
        }

        // 3. STRICT Safety: Read-Only Check
        const upper = query.trim().toUpperCase();
        const isSafe = ['SELECT', 'WITH', 'VALUES'].some(cmd => upper.startsWith(cmd));
        const isDangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'GRANT'].some(cmd => upper.includes(cmd));

        if (!isSafe || isDangerous) {
            return NextResponse.json({ error: 'Safety Block: Only SELECT queries allowed.' }, { status: 403 });
        }

        // 4. Execute
        const result = await db.execute(sql.raw(query));
        return NextResponse.json({ success: true, data: result.rows });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}