//#region node_modules/.nitro/vite/services/ssr/assets/camouflage-COQbritr.js
var CAMOUFLAGE = {
	IPHONE: {
		kind: "IPHONE",
		label: "iPhone",
		identity: "iPhone",
		hostname: "iPhone",
		ttl: 64,
		oui: "A4:83:E7",
		vendor: "Apple",
		hint: "TTL 64 · Apple MAC · DHCP name iPhone"
	},
	ANDROID: {
		kind: "ANDROID",
		label: "Android",
		identity: "Galaxy-S24",
		hostname: "Galaxy-S24",
		ttl: 64,
		oui: "08:EC:A9",
		vendor: "Samsung",
		hint: "TTL 64 · Samsung MAC · DHCP name Galaxy-S24"
	},
	PC: {
		kind: "PC",
		label: "PC",
		identity: "DESKTOP-WIN11",
		hostname: "DESKTOP-WIN11",
		ttl: 128,
		oui: "3C:97:0E",
		vendor: "Intel",
		hint: "TTL 128 · Intel MAC · DHCP name DESKTOP-WIN11"
	}
};
function randomMacFromOui(oui) {
	const b = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
	return `${oui}:${b()}:${b()}:${b()}`;
}
function camouflageScript(profile, iface, mac) {
	const i = iface.replace(/"/g, "");
	return [
		`/system identity set name="${profile.identity}"`,
		`/ip dhcp-client set [find interface="${i}"] host-name=${profile.hostname}`,
		`/interface set [find name="${i}"] mac-address=${mac}`,
		`/ip firewall mangle remove [find comment~"telnet-camouflage"]`,
		`/ip firewall mangle add chain=postrouting action=change-ttl new-ttl=set:${profile.ttl} passthrough=yes comment=telnet-camouflage-ttl`
	].join("\n");
}
//#endregion
export { camouflageScript as n, randomMacFromOui as r, CAMOUFLAGE as t };
