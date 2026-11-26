import { memo, useId } from 'react';

/** Original SVG tabletop ornaments. The SVG is purely decorative and never
 * participates in mouse hit testing or the server's game rules. */
// The scenery has no changing props; retain it across battle input updates.
export const TableDecor=memo(function TableDecor(){
  const id=useId().replace(/:/g,'');
  const wood=id+'w',stone=id+'s',cloth=id+'c',metal=id+'m',grass=id+'g';
  return <svg className="table-decor" viewBox="0 0 1400 800" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={wood} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b98448"/><stop offset=".36" stopColor="#76502e"/><stop offset=".68" stopColor="#4e301b"/><stop offset="1" stopColor="#bd8245"/></linearGradient>
      <linearGradient id={stone} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b7b6a2"/><stop offset=".5" stopColor="#777966"/><stop offset="1" stopColor="#444b3f"/></linearGradient>
      <radialGradient id={cloth}><stop stopColor="#ddc28b"/><stop offset=".68" stopColor="#c3a26f"/><stop offset="1" stopColor="#927248"/></radialGradient>
      <linearGradient id={metal} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#edc583"/><stop offset=".45" stopColor="#99622f"/><stop offset=".64" stopColor="#543921"/><stop offset="1" stopColor="#ba8450"/></linearGradient>
      <radialGradient id={grass}><stop stopColor="#7c8b4d"/><stop offset="1" stopColor="#263a25"/></radialGradient>
    </defs>
    <rect x="0" y="0" width="1400" height="800" fill="#33291f"/>
    <rect x="12" y="10" width="1376" height="780" rx="54" fill={`url(#${wood})`} stroke="#281b13" strokeWidth="10"/>
    <path d="M55 50H1345L1300 108 100 108ZM55 750H1345L1300 698H100Z" fill="#3c2819" opacity=".65"/>
    <path d="M155 104Q182 80 245 87H1156Q1223 80 1246 104L1310 681Q1315 704 1280 715H120Q87 710 91 681Z" fill={`url(#${stone})`} stroke="#352619" strokeWidth="9"/>
    <path d="M174 119Q195 96 247 103H1150Q1205 96 1227 119L1289 663Q1291 685 1263 692H137Q111 684 113 663Z" fill={`url(#${cloth})`} stroke="#674a2d" strokeWidth="5"/>
    <path d="M174 119Q194 100 247 103H1150Q1205 97 1227 119M137 692H1263" stroke="#eed4a2" strokeWidth="3" fill="none" opacity=".45"/>
    <g opacity=".16" stroke="#785431" fill="none" strokeLinecap="round">
      <path d="M211 150Q404 166 581 145M813 151Q1006 161 1178 143M147 627Q330 605 528 629M885 628Q1097 603 1256 628" strokeWidth="4"/>
      <path d="M213 301Q430 290 623 303T1177 299M205 357Q470 369 692 354T1194 359" strokeWidth="2"/>
      <ellipse cx="700" cy="328" rx="233" ry="103" strokeWidth="3"/>
      <ellipse cx="700" cy="328" rx="218" ry="91"/>
      <path d="M700 263 744 328 700 393 656 328Z"/>
      <circle cx="700" cy="328" r="18"/>
    </g>
    <path d="M145 328H1254" stroke="#705530" strokeWidth="3" opacity=".37"/>
    <path d="M145 331H1254" stroke="#f3d8a1" strokeWidth="2" opacity=".45"/>
    {/* Four independent ornamental corner elements. */}
    <g transform="translate(20 24)" stroke="#382b1d" strokeWidth="4">
      <ellipse cx="90" cy="104" rx="87" ry="62" fill={`url(#${grass})`}/>
      <path d="M18 96 15 46 66 11 125 43 131 103Z" fill="#a39375"/>
      <path d="M5 49 67 0 142 46 132 57 68 17 14 60Z" fill="#88472e"/>
      <path d="M37 58H56V80H37ZM83 58H104V80H83Z" fill="#fac173" stroke="#724c2b"/>
      <rect x="63" y="66" width="19" height="37" rx="6" fill="#503622"/>
      <path d="M12 108 42 102 58 116 33 123ZM105 108 139 97 147 115 120 130Z" fill={`url(#${stone})`}/>
    </g>
    <g transform="translate(1248 15)" stroke="#3c3025" strokeWidth="4">
      <ellipse cx="64" cy="100" rx="72" ry="58" fill={`url(#${grass})`}/>
      <path d="M23 116 17 64 34 23 83 18 114 63 106 120Z" fill={`url(#${stone})`}/>
      <path d="M15 63H117M25 43H100M27 91H105" stroke="#555848" strokeWidth="5"/>
      <path d="M43 39 65 28 86 39V100L65 114 43 100Z" fill="#36577c" stroke="#b99758"/>
      <path d="M54 49 65 42 77 49V77L65 91 54 77Z" fill="#cfb06c"/>
      <circle cx="112" cy="120" r="12" fill="#c3924c"/>
    </g>
    <g transform="translate(18 659)" stroke="#3a2b20" strokeWidth="4">
      <ellipse cx="84" cy="58" rx="82" ry="45" fill={`url(#${grass})`}/>
      <path d="M16 48 70 19 138 38 132 91 69 103 17 79Z" fill="#402f26"/>
      <path d="M21 39 70 9 139 28 131 77 69 91 22 67Z" fill="#bd985d"/>
      <path d="M70 9 69 91M31 43 61 27M30 54 59 40M83 26 125 38M82 39 122 50M81 52 119 64" stroke="#735232" fill="none"/>
      <path d="M8 86 25 75 40 91 29 105ZM130 90 153 74 165 91 145 111Z" fill={`url(#${stone})`}/>
    </g>
    <g transform="translate(1237 661)" stroke="#2c413d" strokeWidth="4">
      <ellipse cx="77" cy="66" rx="86" ry="48" fill={`url(#${grass})`}/>
      <path d="M15 84 34 35 58 16 73 47 60 97Z" fill="#559fbd"/>
      <path d="M66 91 73 23 102 0 126 37 110 99Z" fill="#84cbd5"/>
      <path d="M110 86 126 46 147 35 159 63 143 100Z" fill="#406d98"/>
      <path d="M34 35 43 91M73 23 91 91M102 0 91 91M147 35 133 92" stroke="#d1ebe3" opacity=".65" fill="none"/>
    </g>
    <g fill={`url(#${metal})`} stroke="#4d321c" strokeWidth="2">
      {[38,1362].flatMap(x=>[35,767].map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r="10"/>))}
    </g>
  </svg>;
});
