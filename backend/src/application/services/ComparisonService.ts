// ============================================
// SERVICE: Comparison - Application Layer
// ============================================
// Global classification of an assessment (low / medium / high) from its
// physical capacities, against assessments of the same sport and body type
// ============================================

import { prisma } from '../../infrastructure/prismaClient'

export class ComparisonService {
  /**
   * Calculate average of physical capacities
   */
  static calculateCapacitiesAverage(capacities: {
    power?: number | null
    endurance?: number | null
    strength?: number | null
    flexibility?: number | null
    speed?: number | null
  }): number {
    const values = [
      capacities.power,
      capacities.endurance,
      capacities.strength,
      capacities.flexibility,
      capacities.speed
    ].filter((val): val is number => val !== null && val !== undefined)

    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Calculate global classification based on comparison with same sport and bodyType
   * Returns: "low", "medium", or "high"
   */
  static async calculateGlobalClassification(
    athleteId: string,
    currentAverage: number
  ): Promise<string> {
    // Get the athlete to know their sport and bodyType
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { sport: true, bodyType: true }
    })

    if (!athlete) {
      return 'medium' // Default if athlete not found
    }

    // Get all analyses from athletes with same sport and bodyType
    const comparableAnalyses = await prisma.analysis.findMany({
      where: {
        athlete: {
          sport: athlete.sport,
          bodyType: athlete.bodyType,
          deletedAt: null
        }
      },
      select: {
        power: true,
        endurance: true,
        strength: true,
        flexibility: true,
        speed: true
      }
    })

    if (comparableAnalyses.length === 0) {
      return 'medium' // Default if no comparable data
    }

    // Calculate average for each comparable analysis
    const averages = comparableAnalyses.map(analysis =>
      this.calculateCapacitiesAverage(analysis)
    )

    // Calculate cohort statistics
    const cohortAverage = averages.reduce((sum, avg) => sum + avg, 0) / averages.length
    const cohortStdDev = this.calculateStandardDeviation(averages, cohortAverage)

    // Classify based on standard deviation
    // Above 0.5 std dev = high, below -0.5 std dev = low, otherwise = medium
    const zScore = cohortStdDev > 0 ? (currentAverage - cohortAverage) / cohortStdDev : 0

    if (zScore >= 0.5) return 'high'
    if (zScore <= -0.5) return 'low'
    return 'medium'
  }

  /**
   * Calculate standard deviation
   */
  private static calculateStandardDeviation(values: number[], mean: number): number {
    if (values.length === 0) return 0
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
    return Math.sqrt(avgSquaredDiff)
  }
}
