import React from 'react';
import { User } from 'lucide-react';
import { cn } from '../../lib/cn';
import manAvatar from '../../../assets/images/manavtar.png';
import womanAvatar from '../../../assets/images/womenavtar.png';

const femaleNames = new Set([
  'kavya', 'sneha', 'neha', 'anjali', 'priya', 'pooja', 'shradha', 'shreya',
  'riya', 'aarti', 'aditi', 'akansha', 'alisha', 'amrita', 'ananya', 'anita',
  'anushka', 'aparna', 'asha', 'bhavna', 'bhumika', 'chhaya', 'deepa', 'divya',
  'esha', 'gita', 'hema', 'isha', 'jaya', 'jyoti', 'kajal', 'kamala', 'kavita',
  'khushi', 'kiran', 'komal', 'kriti', 'lakshmi', 'lata', 'madhuri', 'mala',
  'mamta', 'manisha', 'maya', 'meena', 'megha', 'mona', 'mukta', 'namrata',
  'nandini', 'neelam', 'nidhi', 'nikita', 'nisha', 'nita', 'pallavi', 'payal',
  'poonam', 'prachi', 'pragati', 'prerna', 'priyanka', 'puja', 'puneet',
  'racha', 'radha', 'radhika', 'rajni', 'rakhi', 'rani', 'rashmi', 'reena',
  'rekha', 'renu', 'richa', 'riddhi', 'rima', 'roshni', 'ruchi', 'ruchika',
  'rupa', 'sakshi', 'sangeeta', 'sanjana', 'sapna', 'sarah', 'sarita', 'savita',
  'seema', 'shailja', 'shalini', 'shanti', 'shikha', 'shilpa', 'shital',
  'shivani', 'shraddha', 'shruti', 'shweta', 'simran', 'smita', 'smriti',
  'sonal', 'sonali', 'sonia', 'sujata', 'suman', 'sunita', 'supriya', 'surabhi',
  'sushma', 'swati', 'tanya', 'tanuja', 'tara', 'tejal', 'tulsi', 'uma',
  'unnati', 'upriya', 'urvashi', 'urvi', 'usha', 'vandana', 'varsha', 'vidya',
  'vimala', 'vinita', 'yamini', 'yashoda', 'yashika'
]);

const maleExceptions = new Set(['krishna', 'shiva', 'aditya', 'ravi', 'hari', 'rishi', 'mukul']);

function getGender(fullName) {
  if (!fullName) return 'unknown';
  const str = typeof fullName === 'string' ? fullName : (fullName?.name || fullName?.fullName || String(fullName || ''));
  const lowerName = str.toLowerCase().trim();
  if (!lowerName) return 'unknown';
  if (lowerName.startsWith('mrs.') || lowerName.startsWith('ms.') || lowerName.startsWith('miss')) return 'female';
  if (lowerName.startsWith('mr.')) return 'male';

  // Extract first name (ignoring titles like Dr.)
  let firstPart = lowerName.split(' ')[0];
  if (firstPart === 'dr.' || firstPart === 'dr') {
    firstPart = lowerName.split(' ')[1] || '';
  }

  if (femaleNames.has(firstPart)) return 'female';
  if (maleExceptions.has(firstPart)) return 'male';

  if (firstPart.endsWith('a') || firstPart.endsWith('i') || firstPart.endsWith('y') || firstPart.endsWith('ee')) {
    return 'female';
  }
  
  return 'male';
}

export function UserAvatar({ name, url, className, size = 16, fallbackSize = 14 }) {
  const gender = getGender(name);
  
  const avatarSrc = url || (gender === 'female' ? womanAvatar : gender === 'male' ? manAvatar : null);

  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-slate-100 overflow-hidden', className)}>
      {avatarSrc ? (
        <img src={avatarSrc} alt={name || 'User'} className="h-full w-full object-cover" />
      ) : (
        <User size={fallbackSize} className="text-slate-500" />
      )}
    </div>
  );
}
