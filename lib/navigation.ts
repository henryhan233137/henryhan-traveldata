import type { TravelStop } from "./trip-data";
export function googleUrl(s:TravelStop){const q=s.location?`${s.location.lat},${s.location.lng}`:s.nativeName||s.title;return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;}
export function amapUrl(s:TravelStop){if(!s.location)return `https://uri.amap.com/search?keyword=${encodeURIComponent(s.nativeName||s.title)}&callnative=1`;return `https://uri.amap.com/marker?position=${s.location.lng},${s.location.lat}&name=${encodeURIComponent(s.nativeName||s.title)}&coordinate=wgs84&callnative=1&src=henry-travel`;}
export function saveFile(name:string,content:string,type="application/json"){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function receiptFile(file:File):Promise<string>{
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>8_000_000)throw new Error("请选择 8MB 以内的 JPG、PNG 或 WebP 图片");
 const image=await createImageBitmap(file);const scale=Math.min(1,900/image.width,900/image.height);
 const c=document.createElement("canvas");c.width=image.width*scale;c.height=image.height*scale;
 c.getContext("2d")!.drawImage(image,0,0,c.width,c.height);image.close();
 for(const quality of [.7,.5,.3]){const data=c.toDataURL("image/jpeg",quality);if(data.length<=180000)return data;}
 throw new Error("图片压缩后仍过大，请裁剪后上传");
}
