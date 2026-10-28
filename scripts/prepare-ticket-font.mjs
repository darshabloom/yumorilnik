import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
const dest=path.join(process.cwd(),"assets","ticket-font.ttf");
const url="https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
await mkdir(path.dirname(dest),{recursive:true});
let available=false;try{const existing=await readFile(dest);available=existing.length>100000}catch{}
if(!available){
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("Unable to fetch licensed Cyrillic font for ticket PDFs: "+response.status);
 const font=Buffer.from(await response.arrayBuffer());
 if(font.length<100000||font.length>4000000||font.readUInt32BE(0)!==0x00010000)throw Error("Invalid font payload");
 await writeFile(dest,font);
}
console.log("Ticket Unicode font available");
