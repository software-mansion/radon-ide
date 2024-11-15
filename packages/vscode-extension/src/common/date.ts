/* Port of strftime() by T. H. Doan (https://thdoan.github.io/strftime/)
 *
 * Day of year (%j) code based on Joe Orost's answer:
 * http://stackoverflow.com/questions/8619879/javascript-calculate-the-day-of-the-year-1-366
 *
 * Week number (%V) code based on Taco van den Broek's prototype:
 * http://techblog.procurios.nl/k/news/view/33796/14863/calculate-iso-8601-week-and-year-in-javascript.html
 */
export function strftime(sFormat: string, date: Date) {
   if (typeof sFormat !== 'string') {
     return '';
   }
 
   if (!(date instanceof Date)) {
     date = new Date();
   }
 
   const nDay = date.getDay();
   const nDate = date.getDate();
   const nMonth = date.getMonth();
   const nYear = date.getFullYear();
   const nHour = date.getHours();
   const nTime = date.getTime();
   const aDays = [
     'Sunday',
     'Monday',
     'Tuesday',
     'Wednesday',
     'Thursday',
     'Friday',
     'Saturday'
   ];
   const aMonths = [
     'January',
     'February',
     'March',
     'April',
     'May',
     'June',
     'July',
     'August',
     'September',
     'October',
     'November',
     'December'
   ];
   const aDayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
   const isLeapYear = () => (nYear % 4 === 0 && nYear % 100 !== 0) || nYear % 400 === 0;
   const getThursday = () => {
     const target = new Date(date);
     target.setDate(nDate - ((nDay + 6) % 7) + 3);
     return target;
   };
   const zeroPad = (nNum, nPad) => ((Math.pow(10, nPad) + nNum) + '').slice(1);
 
   return sFormat.replace(/%[a-z]+\b/gi, (sMatch) => {
     return (({
       '%a': aDays[nDay].slice(0, 3),
       '%A': aDays[nDay],
       '%b': aMonths[nMonth].slice(0, 3),
       '%B': aMonths[nMonth],
       '%c': date.toUTCString().replace(',', ''),
       '%C': Math.floor(nYear / 100),
       '%d': zeroPad(nDate, 2),
       '%e': nDate,
       '%F': (new Date(nTime - (date.getTimezoneOffset() * 60000))).toISOString().slice(0, 10),
       '%G': getThursday().getFullYear(),
       '%g': (getThursday().getFullYear() + '').slice(2),
       '%H': zeroPad(nHour, 2),
       '%I': zeroPad((nHour + 11) % 12 + 1, 2),
       '%j': zeroPad(aDayCount[nMonth] + nDate + ((nMonth > 1 && isLeapYear()) ? 1 : 0), 3),
       '%k': nHour,
       '%l': (nHour + 11) % 12 + 1,
       '%m': zeroPad(nMonth + 1, 2),
       '%n': nMonth + 1,
       '%M': zeroPad(date.getMinutes(), 2),
       '%p': (nHour < 12) ? 'AM' : 'PM',
       '%P': (nHour < 12) ? 'am' : 'pm',
       '%s': Math.round(nTime / 1000),
       '%S': zeroPad(date.getSeconds(), 2),
       '%u': nDay || 7,
       '%V': (() => {
         const target = getThursday();
         const n1stThu = target.valueOf();
         target.setMonth(0, 1);
         const nJan1 = target.getDay();
 
         if (nJan1 !== 4) {
           target.setMonth(0, 1 + ((4 - nJan1) + 7) % 7);
         }
 
         return zeroPad(1 + Math.ceil((n1stThu - target) / 604800000), 2);
       })(),
       '%w': nDay,
       '%x': date.toLocaleDateString(),
       '%X': date.toLocaleTimeString(),
       '%y': (nYear + '').slice(2),
       '%Y': nYear,
       '%z': date.toTimeString().replace(/.+GMT([+-]\d+).+/, '$1'),
       '%Z': date.toTimeString().replace(/.+\((.+?)\)$/, '$1'),
       '%Zs': new Intl.DateTimeFormat('default', {
         timeZoneName: 'short',
       }).formatToParts(date).find((oPart) => oPart.type === 'timeZoneName')?.value,
     }[sMatch] || '') + '') || sMatch;
   });
 }