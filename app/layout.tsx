import "./globals.css";
export const metadata={title:"ScholarHub | Research Repository & Peer Review",description:"Role-based research paper submission and peer-review management system"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><nav className="nav"><div className="nav-in"><a className="brand" href="/">SCHOLAR<span>HUB</span></a><div className="nav-right"><span className="nav-dot"/> DBMS PROJECT <span className="nav-divider">/</span> PES UNIVERSITY</div></div></nav>{children}</body></html>}
