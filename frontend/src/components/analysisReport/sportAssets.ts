// ============================================
// SPORT ASSETS: Sport Report Section
// ============================================
// Centralized per-sport maps (illustrations, placeholders, phase labels).
// No measurement data lives here. Adding a new sport later means adding one
// entry to each map below -- InertialForceCard.tsx itself never needs to change.
// ============================================

import GolfImage from '@/assets/Result_Assessment/Golf.webp'
import TennisImage from '@/assets/Result_Assessment/Tennis.webp'
import PingPongImage from '@/assets/Result_Assessment/PingPong.webp'
import PoloImage from '@/assets/Result_Assessment/Polo.webp'
import AmericanFootballImage from '@/assets/Result_Assessment/AmericanFootball.webp'
import BaseballBatterImage from '@/assets/Result_Assessment/BaseballBatter.webp'
import BaseballPitcherImage from '@/assets/Result_Assessment/BaseballPitcher.webp'
import SoccerGoalkeeperImage from '@/assets/Result_Assessment/SoccerGoalkeeper.webp'
import SoccerPlayerImage from '@/assets/Result_Assessment/SoccerPlayer.webp'

/**
 * Sports the evaluator can pick for an assessment (one per illustration).
 * The choice is stored on the assessment (clinicalResults.snapshot.sport),
 * so the report shows the illustration of the sport actually evaluated.
 */
export const ASSESSMENT_SPORTS: string[] = [
    'Golf',
    'Tennis',
    'Ping Pong',
    'Polo',
    'American Football',
    'Baseball Batter',
    'Baseball Pitcher',
    'Soccer Goalkeeper',
    'Soccer Player'
]

/** Sport name -> illustrative image. Add one entry here (and in ASSESSMENT_SPORTS) per new sport. */
export const SPORT_IMAGES: Record<string, string> = {
    Golf: GolfImage,
    Tennis: TennisImage,
    'Ping Pong': PingPongImage,
    'Table Tennis': PingPongImage,
    Polo: PoloImage,
    'American Football': AmericanFootballImage,
    'Baseball Batter': BaseballBatterImage,
    'Baseball Pitcher': BaseballPitcherImage,
    'Soccer Goalkeeper': SoccerGoalkeeperImage,
    'Soccer Player': SoccerPlayerImage
}

/** Sentinel value AddAthlete/EditAthlete store on Athlete.sport for patients who aren't athletes. */
const NON_ATHLETE_SPORT = 'None'

/**
 * True when the patient has an actual sport recorded — false for patients
 * with no sport or the "not an athlete" sentinel. Callers use this to decide
 * whether to render the Sport Report section at all (as opposed to an
 * unsupported-but-present sport, which still renders with a placeholder).
 */
export function hasSportReport(sport?: string | null): boolean {
    return Boolean(sport && sport !== NON_ATHLETE_SPORT)
}

/** Pre-selects the assessment sport from the patient's profile when it matches an available illustration. */
export function defaultAssessmentSport(athleteSport?: string | null): string {
    if (!athleteSport) return ''
    if (athleteSport === 'Table Tennis') return 'Ping Pong'
    return ASSESSMENT_SPORTS.find((s) => s.toLowerCase() === athleteSport.trim().toLowerCase()) ?? ''
}

/** Sport name -> short placeholder copy shown when no illustrative image exists yet. */
export const SPORT_PLACEHOLDERS: Record<string, string> = {}

export const DEFAULT_SPORT_PLACEHOLDER = 'No sport-specific illustration available yet.'

/**
 * Sport name -> movement phases used to lay out the Inertial Force chart.
 * Layout only: no values are shown until inertial force is actually
 * acquired and calculated (a wrist IMU alone does not give body force).
 */
export const INERTIAL_FORCE_PHASES: Record<string, string[]> = {
    Golf: ['Backswing', 'Transition', 'Impact', 'Follow Through']
}
