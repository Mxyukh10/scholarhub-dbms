import "./globals.css";
export const metadata={title:"ScholarHub | Research Review Workflow",description:"DBMS mini-project demonstration"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><nav className="nav"><div className="nav-in"><a className="brand" href="/">Scholar<i>Hub</i></a><a className="pill" href="/login">Author · Reviewer · Admin</a></div></nav>{children}</body></html>}
