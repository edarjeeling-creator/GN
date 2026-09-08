import {
  Users, BookOpen, Award, FileText, Phone, CheckCircle, Trophy, 
  Image as ImageIcon, Shield, Megaphone, Bell, GraduationCap, Star, Globe, 
  Heart, Smile, Lightbulb, Briefcase, Target, Compass, Activity, Feather,
  HelpCircle, MapPin, ArrowRight, ChevronRight, ChevronLeft, Calendar, Quote
} from 'lucide-react';

export const CMS_ICON_MAP = {
  Users, BookOpen, Award, FileText, Phone, CheckCircle, Trophy,
  ImageIcon, Shield, Megaphone, Bell, GraduationCap, Star, Globe,
  Heart, Smile, Lightbulb, Briefcase, Target, Compass, Activity, Feather,
  HelpCircle, MapPin, ArrowRight, ChevronRight, ChevronLeft, Calendar, Quote
};

export const CMS_ICON_LIST = [
  'Users', 'BookOpen', 'Award', 'FileText', 'Phone', 'CheckCircle', 'Trophy', 
  'ImageIcon', 'Shield', 'Megaphone', 'Bell', 'GraduationCap', 'Star', 'Globe', 
  'Heart', 'Smile', 'Lightbulb', 'Briefcase', 'Target', 'Compass', 'Activity', 'Feather'
];

export const getCmsIcon = (iconName, fallback = BookOpen) => {
  if (!iconName) return fallback;
  return CMS_ICON_MAP[iconName] || fallback;
};
