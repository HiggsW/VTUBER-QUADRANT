/* Local HTML may display file images but cannot read their canvas pixels.
 * Load the generated data-URI asset table only when a local export needs it. */
(() => {
  let pending;
  window.loadBundledAvatar = async function(id) {
    if (!/^[a-z]+-\d+$/.test(id)) throw new Error('无效的头像标识');
    if (!pending) pending = new Promise((resolve, reject) => {
      if (window.__cluckworksAvatarData) { resolve(window.__cluckworksAvatarData); return; }
      const script = document.createElement('script');
      script.src = new URL('avatar-data.js?v=local-export-5', document.baseURI).href;
      script.onload = () => window.__cluckworksAvatarData ? resolve(window.__cluckworksAvatarData) : reject(new Error('头像数据包为空'));
      script.onerror = () => { pending = undefined; reject(new Error('缺少 avatar-data.js，请保留完整网页文件')); };
      document.head.appendChild(script);
    });
    const data = await pending;
    if (!data[id]) throw new Error('数据包中未找到头像：' + id);
    return data[id];
  };
})();
