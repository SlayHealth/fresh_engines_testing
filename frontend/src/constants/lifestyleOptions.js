import {
  Coffee, Footprints, Zap, Trophy,
  WineOff, Martini, Beer, BottleWine,
  CigaretteOff, Cigarette, Package,
  Sunrise, MoonStar, Shuffle, Eye,
  CalendarCheck, CalendarX, CalendarOff,
  ShieldCheck, User, Users
} from 'lucide-react';

// Renders a tight row of `count` copies of the same icon, for options whose intensity
// reads better as a quantity (one glass vs two) than a single symbol. Ignores the
// `w-5 h-5` sizing className ChoiceList passes in — a cluster needs its own compact
// layout — but still honors the incoming `style` (color), so selected/unselected
// states keep working.
function iconCluster(Icon, count) {
  return function Cluster({ style }) {
    return (
      <div className="flex items-center justify-center gap-px" style={{ width: 22, height: 20 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Icon key={i} style={{ ...style, width: 11, height: 11 }} />
        ))}
      </div>
    );
  };
}

// Same idea, stacked vertically instead of side-by-side — for cases where a
// horizontal row of `count` icons reads as too compact/small to tell apart.
function iconStack(Icon, count) {
  return function Stack({ style }) {
    return (
      <div className="flex flex-col items-center justify-center gap-px" style={{ width: 20, height: 22 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Icon key={i} style={{ ...style, width: 13, height: 13 }} />
        ))}
      </div>
    );
  };
}

export const LIFESTYLE_ACTIVITIES = [
  { val: 'Sedentary', label: 'Sedentary', desc: 'Little to no regular exercise, 0-1 times a week', icon: Coffee },
  { val: 'Moderate', label: 'Moderate', desc: 'Light exercise, about 1-3 times a week', icon: Footprints },
  { val: 'Active', label: 'Active', desc: 'Regular exercise, about 3-5 times a week', icon: Zap },
  { val: 'Athletic', label: 'Athletic', desc: 'Daily intense exercise or sports, 6-7 times a week', icon: Trophy }
];

// WS1A04/WS3B01: feeds the IDRS family-history axis (none 0 / one parent 10 / both
// parents 20, per the validated MDRF-IDRS instrument) — previously uncaptured in
// the live wizard, so this always silently scored as "none" regardless of a
// person's real history.
export const FAMILY_HISTORY_DIABETES = [
  { val: 'None', label: 'Neither parent', desc: 'No parent diagnosed with diabetes', icon: ShieldCheck },
  { val: 'One', label: 'One parent', desc: 'One parent diagnosed with diabetes', icon: User },
  { val: 'Both', label: 'Both parents', desc: 'Both parents diagnosed with diabetes', icon: Users }
];

export const LIFESTYLE_DRINKING = [
  { val: 'Never', label: 'Never', desc: 'No alcohol consumption at all', icon: WineOff },
  { val: 'socially', label: 'Socially', desc: 'Occasional drinks with company, roughly 1-2 times a month', icon: Martini },
  { val: 'regularly', label: 'Regularly', desc: 'Regular drinking, roughly 2-3 times a week', icon: iconCluster(Beer, 2) },
  { val: 'heavily', label: 'Heavily', desc: 'Frequent or binge drinking, 4 or more times a week', icon: BottleWine }
];

// Smoking and (smokeless) tobacco use — chewing tobacco, gutka, paan masala — asked as one
// combined question rather than two, since both map to the same downstream risk signal.
export const LIFESTYLE_SMOKING_TOBACCO = [
  { val: 'never', label: 'Never', desc: 'No smoking or tobacco use of any kind', icon: CigaretteOff },
  { val: 'occasion', label: 'Occasional', desc: 'A few cigarettes or tobacco uses a month, mostly social settings', icon: Cigarette },
  { val: 'regular', label: 'Regular', desc: 'Daily use, roughly 5-10 cigarettes or tobacco servings a day', icon: iconStack(Cigarette, 2) },
  { val: 'chain', label: 'Heavy', desc: 'Heavy daily use — a pack (20+ cigarettes) or more, or equivalent tobacco intake', icon: Package }
];

export const LIFESTYLE_SLEEP = [
  { val: 'Early Bird', label: 'Early Bird', desc: 'Sleep early, wake early', icon: Sunrise },
  { val: 'night owl', label: 'Night Owl', desc: 'Sleep late, wake late', icon: MoonStar },
  { val: 'irregular', label: 'Irregular', desc: 'Shifting sleep schedule', icon: Shuffle },
  { val: 'insomniac', label: 'Insomniac', desc: 'Difficulty sleeping', icon: Eye }
];

export const LIFESTYLE_MENSTRUAL = [
  { val: 'Regular', label: 'Regular', desc: 'Normal cycle monthly pattern', icon: CalendarCheck },
  { val: 'Irregular', label: 'Irregular', desc: 'Inconsistent start times', icon: CalendarX },
  { val: 'Menopause', label: 'Menopause', desc: 'Permanent cessation of cycle', icon: CalendarOff }
];

export const GENDERS = [
  { val: 'Male', label: 'Male' },
  { val: 'Female', label: 'Female' },
  { val: 'Other', label: 'Other' }
];

export const RELATIONS = [
  { val: 'Self', label: 'Self', desc: "It's me getting married" },
  { val: 'Parents', label: 'Parents', desc: "I'm a parent filling this in" },
  { val: 'Siblings', label: 'Siblings', desc: "I'm a sibling filling this in" },
  { val: 'Friends', label: 'Friends', desc: "I'm a friend filling this in" },
  { val: 'Relatives', label: 'Relatives', desc: "I'm a relative filling this in" }
];

export const MEETING_SOURCES = [
  { val: 'Family Introduction', label: 'Family Introduction' },
  { val: 'Matrimonial Platform', label: 'Matrimonial Platform' },
  { val: 'Work/College', label: 'Work/College' },
  { val: 'Friends', label: 'Friends' },
  { val: 'Other', label: 'Other' }
];

export const MATRIMONIAL_PLATFORMS = [
  { val: 'Shaadi.com', label: 'Shaadi.com' },
  { val: 'BharatMatrimony', label: 'BharatMatrimony' },
  { val: 'Jeevansathi', label: 'Jeevansathi' },
  { val: 'Elite Matrimony', label: 'Elite Matrimony' },
  { val: 'Other', label: 'Other' }
];

export const RELATIONSHIP_STATUSES = [
  { val: 'Single', label: 'Single' },
  { val: 'Engaged', label: 'Engaged' },
  { val: 'In a Relationship', label: 'In a Relationship' }
];

export const MARRIAGE_TIMELINES = [
  { val: 'Within 6 months', label: 'Within 6 months' },
  { val: '6 - 12 months', label: '6 - 12 months' },
  { val: '1 - 2 years', label: '1 - 2 years' },
  { val: '2+ years', label: '2+ years' },
  { val: 'Not sure yet', label: 'Not sure yet' }
];

export const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat',
  'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
  'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
  'Meerut', 'Rajkot', 'Kalyan-Dombivli', 'Vasai-Virar', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad',
  'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior',
  'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Thiruvananthapuram',
  'Mysuru', 'Noida', 'Gurugram'
];

export const COUNTRIES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' }
];
