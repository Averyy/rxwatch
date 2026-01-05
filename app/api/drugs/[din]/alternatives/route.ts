import { NextResponse } from 'next/server';
import { db, drugs } from '@/db';
import { eq, ne, and, or, sql, asc } from 'drizzle-orm';

/**
 * GET /api/drugs/[din]/alternatives
 * Find alternative drugs for a given DIN
 *
 * Strategy:
 * 1. Same active ingredient, different company (generic equivalents)
 * 2. Same ATC code level 5, same form/route (therapeutic alternatives)
 *
 * Query params:
 * - availableOnly=true  Only show alternatives not in shortage
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ din: string }> }
) {
  try {
    const { din } = await params;
    const { searchParams } = new URL(request.url);
    const availableOnly = searchParams.get('availableOnly') === 'true';

    // Validate DIN format
    if (!/^\d{8}$/.test(din)) {
      return NextResponse.json(
        { error: 'Invalid DIN format. Must be 8 digits.' },
        { status: 400 }
      );
    }

    // Get the source drug
    const [sourceDrug] = await db
      .select({
        din: drugs.din,
        brandName: drugs.brandName,
        activeIngredient: drugs.activeIngredient,
        strength: drugs.strength,
        strengthUnit: drugs.strengthUnit,
        form: drugs.form,
        route: drugs.route,
        atcCode: drugs.atcCode,
        company: drugs.company,
        currentStatus: drugs.currentStatus,
      })
      .from(drugs)
      .where(eq(drugs.din, din))
      .limit(1);

    if (!sourceDrug) {
      return NextResponse.json(
        { error: 'Drug not found', din },
        { status: 404 }
      );
    }

    // Build conditions for alternatives
    const conditions = [
      ne(drugs.din, din), // Exclude source drug
      sql`${drugs.marketStatus} = 'Marketed'`, // Only marketed drugs
    ];

    if (availableOnly) {
      conditions.push(sql`${drugs.currentStatus} = 'available'`);
    }

    // Find alternatives by same active ingredient
    let ingredientAlternatives: typeof sourceDrug[] = [];
    if (sourceDrug.activeIngredient) {
      ingredientAlternatives = await db
        .select({
          din: drugs.din,
          brandName: drugs.brandName,
          activeIngredient: drugs.activeIngredient,
          strength: drugs.strength,
          strengthUnit: drugs.strengthUnit,
          form: drugs.form,
          route: drugs.route,
          atcCode: drugs.atcCode,
          company: drugs.company,
          currentStatus: drugs.currentStatus,
        })
        .from(drugs)
        .where(
          and(
            eq(drugs.activeIngredient, sourceDrug.activeIngredient),
            ...conditions
          )
        )
        .orderBy(
          // Prefer available drugs first
          sql`CASE WHEN ${drugs.currentStatus} = 'available' THEN 0 ELSE 1 END`,
          asc(drugs.brandName)
        )
        .limit(50);
    }

    // Find alternatives by same ATC code (therapeutic class)
    let atcAlternatives: typeof sourceDrug[] = [];
    if (sourceDrug.atcCode && sourceDrug.atcCode.length >= 5) {
      // Use first 5 chars of ATC code for therapeutic equivalence
      const atcPrefix = sourceDrug.atcCode.substring(0, 5);

      atcAlternatives = await db
        .select({
          din: drugs.din,
          brandName: drugs.brandName,
          activeIngredient: drugs.activeIngredient,
          strength: drugs.strength,
          strengthUnit: drugs.strengthUnit,
          form: drugs.form,
          route: drugs.route,
          atcCode: drugs.atcCode,
          company: drugs.company,
          currentStatus: drugs.currentStatus,
        })
        .from(drugs)
        .where(
          and(
            sql`${drugs.atcCode} LIKE ${atcPrefix + '%'}`,
            // Exclude drugs already in ingredient alternatives
            sourceDrug.activeIngredient
              ? ne(drugs.activeIngredient, sourceDrug.activeIngredient)
              : sql`TRUE`,
            ...conditions
          )
        )
        .orderBy(
          sql`CASE WHEN ${drugs.currentStatus} = 'available' THEN 0 ELSE 1 END`,
          asc(drugs.brandName)
        )
        .limit(30);
    }

    return NextResponse.json({
      sourceDrug,
      alternatives: {
        // Same ingredient = direct substitutes (generic equivalents)
        sameIngredient: ingredientAlternatives,
        // Same ATC = therapeutic alternatives (different ingredient, same class)
        sameTherapeuticClass: atcAlternatives,
      },
      counts: {
        sameIngredient: ingredientAlternatives.length,
        sameTherapeuticClass: atcAlternatives.length,
        total: ingredientAlternatives.length + atcAlternatives.length,
      },
      disclaimer: 'Always consult a pharmacist or healthcare provider before substituting medications.',
    }, {
      headers: { 'Cache-Control': 'public, max-age=900' }, // 15 min
    });
  } catch (error) {
    console.error('Error fetching alternatives:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alternatives' },
      { status: 500 }
    );
  }
}
