import {
  Coffee, Footprints, Zap, Trophy, Briefcase, Beer, Flame, Sparkles, Moon, Calendar
} from 'lucide-react';

export const LIFESTYLE_ACTIVITIES = [
  { val: 'Sedentary', label: 'Sedentary', desc: 'Little to no regular exercise', icon: Coffee },
  { val: 'Moderate', label: 'Moderate', desc: 'Light exercise 1-3 times/week', icon: Footprints },
  { val: 'Active', label: 'Active', desc: 'Exercise 3-5 times/week', icon: Zap },
  { val: 'Athletic', label: 'Athletic', desc: 'Daily intense exercise/sports', icon: Trophy }
];

export const LIFESTYLE_STEPS = [
  { val: '<3,000', label: 'Less than 3,000', desc: 'Mostly sitting', icon: Footprints },
  { val: '3,000 - 5,000', label: '3,000 - 5,000', desc: 'Light walking', icon: Footprints },
  { val: '5,000 - 10,000', label: '5,000 - 10,000', desc: 'Active day', icon: Footprints },
  { val: '10,000+', label: '10,000+', desc: 'Very active', icon: Footprints }
];

export const LIFESTYLE_OCCUPATIONS = [
  { val: 'Sitting 8h+', label: 'Sitting 8h+', desc: 'Desk bound, high sedentary time', icon: Briefcase },
  { val: 'Sitting 4h+', label: 'Sitting 4h+', desc: 'Moderate movement during work', icon: Briefcase },
  { val: 'travelling', label: 'Travelling', desc: 'On the move frequently', icon: Briefcase },
  { val: 'other', label: 'Other', desc: 'Varying work environment', icon: Briefcase }
];

export const LIFESTYLE_DRINKING = [
  { val: 'Never', label: 'Never', desc: 'No alcohol consumption', icon: Beer },
  { val: 'socially', label: 'Socially', desc: 'Occasional drinks with company', icon: Beer },
  { val: 'regularly', label: 'Regularly', desc: 'Regular weekly drinks', icon: Beer },
  { val: 'heavily', label: 'Heavily', desc: 'High frequency/binge drinking', icon: Beer },
  { val: 'other', label: 'Other', desc: 'Varying patterns', icon: Beer }
];

export const LIFESTYLE_SMOKING = [
  { val: 'never', label: 'Never', desc: 'No tobacco smoking', icon: Flame },
  { val: 'occasion', label: 'Occasion', desc: 'Occasional social smoking', icon: Flame },
  { val: 'regular', label: 'Regular', desc: 'Daily smoking', icon: Flame },
  { val: 'chain', label: 'Chain', desc: 'High frequency smoking', icon: Flame }
];

export const LIFESTYLE_TOBACCO = [
  { val: 'never', label: 'Never', desc: 'No tobacco use', icon: Sparkles },
  { val: 'occasional', label: 'Occasional', desc: 'Occasional usage', icon: Sparkles },
  { val: 'regular', label: 'Regular', desc: 'Daily usage', icon: Sparkles }
];

export const LIFESTYLE_SLEEP = [
  { val: 'Early Bird', label: 'Early Bird', desc: 'Sleep early, wake early', icon: Moon },
  { val: 'night owl', label: 'Night Owl', desc: 'Sleep late, wake late', icon: Moon },
  { val: 'irregular', label: 'Irregular', desc: 'Shifting sleep schedule', icon: Moon },
  { val: 'insomniac', label: 'Insomniac', desc: 'Difficulty sleeping', icon: Moon }
];

export const LIFESTYLE_MENSTRUAL = [
  { val: 'Regular', label: 'Regular', desc: 'Normal cycle monthly pattern', icon: Calendar },
  { val: 'Irregular', label: 'Irregular', desc: 'Inconsistent start times', icon: Calendar },
  { val: 'Menopause', label: 'Menopause', desc: 'Permanent cessation of cycle', icon: Calendar },
  { val: 'Other', label: 'Other', desc: 'Other patterns', icon: Calendar }
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
