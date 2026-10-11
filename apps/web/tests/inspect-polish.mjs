import { chromium } from '@playwright/test';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:process.argv[2]==='desktop'?{width:1440,height:900}:{width:390,height:844},reducedMotion:'reduce'});
await page.goto(process.env.POLISH_BASE_URL ?? 'http://localhost:5176');
await page.getByRole('button',{name:'My profile',exact:true}).waitFor();
if(process.argv[2]!=='desktop') await page.getByRole('button',{name:'More',exact:true}).click();
await page.screenshot({path:`tests/screenshots/POLISH-001/after-${process.argv[2]==='desktop'?'desktop':'mobile'}-expanded.png`});
for(const name of ['Home','My profile','Check in','Weekly goal','Week','Shop','Mayor','Gazette','Compete']) {
 if(name !== 'Home') await page.getByRole('button',{name,exact:true}).click();
 await page.waitForTimeout(700);
 const d=name==='Home'?page.locator('.app'):name==='My profile'?page.locator('.profile-panel'):page.getByRole('dialog');
 console.log(name,await d.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,primary:el.querySelectorAll('.button.primary').length})));
 console.log(await d.evaluate(root => {
   const rgb = text => (text.match(/[\d.]+/g)||[]).map(Number);
   const lum = c => c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const failures=[];
   for (const el of root.querySelectorAll('*')) {
     if(!el.getClientRects().length || el.closest(':disabled, [aria-hidden=true], .scene') || ![...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim())) continue;
     const style=getComputedStyle(el); if(style.visibility==='hidden') continue;
     let bg=[250,249,243]; const stack=[];
     for(let a=el;a;a=a.parentElement) stack.unshift(a);
     for(const a of stack){const c=rgb(getComputedStyle(a).backgroundColor); const alpha=c[3]??1; bg=bg.map((v,i)=>c[i]*alpha+v*(1-alpha));}
     const fg=rgb(style.color); const l=[lum(fg),lum(bg)].sort((a,b)=>b-a); const ratio=(l[0]+.05)/(l[1]+.05);
     if(ratio<4.5) failures.push({text:el.textContent.trim().slice(0,45),selector:el.tagName+'.'+el.className,ratio:ratio.toFixed(2),color:style.color});
   } return failures;
 }));
 if(name==='Week') await page.screenshot({path:`tests/screenshots/POLISH-001/after-${process.argv[2]==='desktop'?'desktop':'mobile'}-week.png`});
 if(name !== 'Home') await page.getByRole('button',{name:name==='My profile'?'Close profile':'Close dialog'}).click();
}
await browser.close();
