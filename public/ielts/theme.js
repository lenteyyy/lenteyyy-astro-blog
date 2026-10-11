try {
 const saved=localStorage.getItem('ielts-theme');
 const systemDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
 document.documentElement.dataset.ieltsTheme=saved==='dark'||(!saved&&systemDark)?'dark':'light';
} catch {}
