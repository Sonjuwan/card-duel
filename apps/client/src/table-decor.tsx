import { memo, useId } from 'react';

/** Original SVG tabletop ornaments. The SVG is purely decorative and never
 * participates in mouse hit testing or the server's game rules. */
// The scenery has no changing props; retain it across battle input updates.
export const TableDecor=memo(function TableDecor(){
  const id=useId().replace(/:/g,'');
  const wood=id+'w',stone=id+'s',cloth=id+'c',metal=id+'m',grass=id+'g';
  return <svg className="table-decor" viewBox="0 0 1400 800" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={wood} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#655344"/><stop offset=".36" stopColor="#363442"/><stop offset=".68" stopColor="#201e2a"/><stop offset="1" stopColor="#72604e"/></linearGradient>
      <linearGradient id={stone} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#727589"/><stop offset=".5" stopColor="#474657"/><stop offset="1" stopColor="#2b303b"/></linearGradient>
      <radialGradient id={cloth}><stop stopColor="#44465d"/><stop offset=".68" stopColor="#35374c"/><stop offset="1" stopColor="#252936"/></radialGradient>
      <linearGradient id={metal} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ccad78"/><stop offset=".45" stopColor="#6e574a"/><stop offset=".64" stopColor="#38303d"/><stop offset="1" stopColor="#8e7255"/></linearGradient>
      <radialGradient id={grass}><stop stopColor="#32364d"/><stop offset="1" stopColor="#202439"/></radialGradient>
    </defs>
    <rect x="0" y="0" width="1400" height="800" fill="#151923"/>
    <rect x="12" y="10" width="1376" height="780" rx="54" fill={`url(#${wood})`} stroke="#15131e" strokeWidth="10"/>
    <path d="M55 50H1345L1300 108 100 108ZM55 750H1345L1300 698H100Z" fill="#252631" opacity=".65"/>
    <rect x="96" y="80" width="1208" height="640" rx="40" fill={`url(#${stone})`} stroke="#22202a" strokeWidth="9"/>
    <rect x="118" y="101" width="1164" height="598" rx="29" fill={`url(#${cloth})`} stroke="#6a5648" strokeWidth="5"/>
    <g opacity=".17" stroke="#bd9c76" fill="none">
      <ellipse cx="700" cy="400" rx="233" ry="103" strokeWidth="3"/>
      <ellipse cx="700" cy="400" rx="218" ry="91"/>
      <path d="M700 335 744 400 700 465 656 400Z M700 365 725 400 700 437 675 400Z M675 400H725 M700 365V437"/>
      <circle cx="700" cy="400" r="18"/>
    </g>
    {/* Four independent ornamental corner elements. */}
    <g transform="translate(20 24)" stroke="#382b1d" strokeWidth="4">
      <ellipse cx="90" cy="104" rx="87" ry="62" fill={`url(#${grass})`}/>
      <path d="M18 96 15 46 66 11 125 43 131 103Z" fill="#635c65"/>
      <path d="M5 49 67 0 142 46 132 57 68 17 14 60Z" fill="#644b4d"/>
      <path d="M37 58H56V80H37ZM83 58H104V80H83Z" fill="#e4b979" stroke="#724c2b"/>
      <rect x="63" y="66" width="19" height="37" rx="6" fill="#44353f"/>
      <path d="M12 108 42 102 58 116 33 123ZM105 108 139 97 147 115 120 130Z" fill={`url(#${stone})`}/>
    </g>
    <g transform="translate(1248 15)" stroke="#3c3025" strokeWidth="4">
      <ellipse cx="64" cy="100" rx="72" ry="58" fill={`url(#${grass})`}/>
      <path d="M23 116 17 64 34 23 83 18 114 63 106 120Z" fill={`url(#${stone})`}/>
      <path d="M15 63H117M25 43H100M27 91H105" stroke="#555848" strokeWidth="5"/>
      <path d="M43 39 65 28 86 39V100L65 114 43 100Z" fill="#2d4763" stroke="#b99758"/>
      <path d="M54 49 65 42 77 49V77L65 91 54 77Z" fill="#ad956b"/>
      <circle cx="112" cy="120" r="12" fill="#c3924c"/>
    </g>
    <g transform="translate(18 659)" stroke="#3a2b20" strokeWidth="4">
      <ellipse cx="84" cy="58" rx="82" ry="45" fill={`url(#${grass})`}/>
      <path d="M16 48 70 19 138 38 132 91 69 103 17 79Z" fill="#402f26"/>
      <path d="M21 39 70 9 139 28 131 77 69 91 22 67Z" fill="#6b5d56"/>
      <path d="M70 9 69 91M31 43 61 27M30 54 59 40M83 26 125 38M82 39 122 50M81 52 119 64" stroke="#735232" fill="none"/>
      <path d="M8 86 25 75 40 91 29 105ZM130 90 153 74 165 91 145 111Z" fill={`url(#${stone})`}/>
    </g>
    <g transform="translate(1237 661)" stroke="#2c413d" strokeWidth="4">
      <ellipse cx="77" cy="66" rx="86" ry="48" fill={`url(#${grass})`}/>
      <path d="M15 84 34 35 58 16 73 47 60 97Z" fill="#426e88"/>
      <path d="M66 91 73 23 102 0 126 37 110 99Z" fill="#5c9eaa"/>
      <path d="M110 86 126 46 147 35 159 63 143 100Z" fill="#395674"/>
      <path d="M34 35 43 91M73 23 91 91M102 0 91 91M147 35 133 92" stroke="#d1ebe3" opacity=".65" fill="none"/>
    </g>
    <g fill={`url(#${metal})`} stroke="#4d321c" strokeWidth="2">
      {[38,1362].flatMap(x=>[35,767].map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r="10"/>))}
    </g>
  </svg>;
});
