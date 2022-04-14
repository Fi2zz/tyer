function div(props, ...rest) {
	rest = Array.prototype.slice.call(rest).filter(Boolean);
	const children = rest.flat().join(" ");
	const attributes = Object.entries(props).map(([key, value]) => {
		if (!value) return "";
		value = `${value}`.trim();
		return `${key}="${value}"`;
	});
	return `<div ${attributes.join("")}>${children}</div>`;
}
const Modes = {
	Date: "date",
	Range: "range",
	Calendar: "calendar",
};

function isDate(date) {
	return date && date instanceof Date;
}

function toString(object) {
	return object.toString();
}

function createIntl({ locale, mode, intl }) {
	if (intl) return intl;
	const dayIntl = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
	const dateIntl = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
	});
	const monthIntl = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: mode == Modes.Calendar ? void 0 : "numeric",
	});
	const yearIntl = new Intl.DateTimeFormat(locale, { year: "numeric" });
	return {
		day: (date) => dayIntl.format(date),
		date: (date) => dateIntl.format(date),
		month: (date) => monthIntl.format(date),
		year: (date) => yearIntl.format(date),
	};
}

class Core {
	$$values = Object.create(null);
	get values() {
		const result = [];
		for (const key in this.$$values) {
			result.push(this.$$values[key]);
		}
		return result.sort((a, b) => +a - +b);
	}
	get value() {
		return this.$$values;
	}
	set value(value) {
		this.$$values = value;
		const values = this.values;
		this.onChange();
		this.date = values[0];
	}
	get date() {
		return this._date;
	}
	set date(date) {
		if (date) this._date = new Date(date.getFullYear(), date.getMonth());
		this.onUpdate();
	}
	constructor(mode, onChange) {
		this.mode = mode || Modes.Date;
		this.onChange = () => onChange(this.values);
	}
	has(date) {
		if (!isDate(date)) return false;
		const values = Object.keys(this.value);
		const key = toString(date);
		return values.includes(key) ? key : false;
	}
	setValue = (...value) => {
		if (!value) return;
		value = Array.from(value);
		value = Array.from(new Set(value)).filter(isDate);
		const start = this.mode == Modes.Range ? value.length - 2 : 0;
		const count = this.mode == Modes.Range ? undefined : 1;
		this.updateValue(value.slice(start, count));
	};
	setRange(...arg) {
		if (this.mode != Modes.Range) return;
		const [a, b] = arg;
		return this.setValue(a, b);
	}

	getValue() {
		return this.values;
	}
	_setValue(date) {
		if (!date) return;
		const key = this.has(date);
		if (key) {
			const next = Object.entries(this.value).map(
				([_key, value]) => key !== _key && value
			);
			this.updateValue(next);
			return;
		}
		if (this.mode != Modes.Range) return this.updateValue([date]);
		const unique = new Set([...this.values, date]);
		const value = Array.from(unique).sort((a, b) => a - b);
		this.updateValue(value.slice(value.length - 2));
	}
	updateValue(value) {
		this.value = value.reduce((acc, date) => {
			if (!date) return acc;
			date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
			const key = toString(date);
			acc[key] = date;
			return acc;
		}, Object.create(null));
	}
	setMonth(step) {
		if (this.mode == Modes.Calendar) step *= 12;
		this.date = new Date(
			this._date.getFullYear(),
			this._date.getMonth() + step
		);
	}
	setDate(date) {
		if (!date || !date instanceof Date) throw `Invald Date`;
		this.date = new Date(date.getFullYear(), date.getMonth(), 1);
	}
	getRange() {
		const calendar = () => {
			const year = this._date.getFullYear();
			return Array.from({ length: 12 }, (_, index) => new Date(year, index, 1));
		};
		const range = () => [
			this._date,
			new Date(this._date.getFullYear(), this._date.getMonth() + 1, 1),
		];
		const date = () => [this._date];
		return this.match(date, range, calendar);
	}

	get modes() {
		const calendar = () => {
			const year = this._date.getFullYear();
			return Array.from({ length: 12 }, (_, index) => new Date(year, index, 1));
		};
		const range = () => [
			this._date,
			new Date(this._date.getFullYear(), this._date.getMonth() + 1, 1),
		];
		const date = () => [this._date];
		return { calendar, date, range };
	}

	getDatesByMonth = (date) => {
		const currYear = date.getFullYear();
		const currMonth = date.getMonth();
		const utc = Date.UTC(currYear, currMonth + 1, 0);
		const length = new Date(utc).getUTCDate();
		const currentDay = date.getDay();
		return [
			{
				date: new Date(currYear, currMonth, 0),
				length: currentDay,
				activated: false,
			},
			{
				date: new Date(currYear, currMonth, 1),
				length,
				activated: true,
			},
			{
				date: new Date(currYear, currMonth + 1),
				length: 42 - length - currentDay,
				activated: false,
			},
		].reduce((acc, item, index) => {
			const step = index > 0 ? 1 : -1;
			const list = Array.from({ length: item.length }, (_, index) => {
				const date = new Date(
					item.date.getFullYear(),
					item.date.getMonth(),
					item.date.getDate() + index * step
				);
				return {
					date: date,
					activated: item.activated,
					active: item.activated && Boolean(this.has(date)),
					time: item.activated ? +date : null,
					text: date.getDate(),
				};
			});
			if (index > 0) return acc.concat(list);
			return acc.concat(list.reverse());
		}, []);
	};
}
class UI {
	get weekday() {
		const today = new Date();
		const map = (_, index) =>
			new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
		return Array.from({ length: 7 }, map)
			.sort((a, b) => a.getDay() - b.getDay())
			.map((date) => this.intl.day(date))
			.map((text) => div({ class: "cell" }, text));
	}

	constructor({ mode, intl, locale, core, el }) {
		this.mode = mode;
		this.intl = createIntl({ intl, locale });
		this.core = core;
		core.onUpdate = () => this.render(el, mode, core.modes);
		core.setDate(new Date());
	}
	match(date, range, calendar) {
		let next;
		switch (this.mode) {
			case Modes.Range:
				next = range;
				break;

			case Modes.Calendar:
				next = calendar;
				break;
			case Modes.Date:
			default:
				next = date;
				break;
		}
		return typeof next == "function" ? next() : next;
	}
	render(el, mode, modes) {
		const $ = (selector) => Array.from(el.querySelectorAll(selector));
		const buildHTML = (mode, modes, core) => {
			const body = (date) =>
				core.getDatesByMonth(date).map((item) => {
					const _props = {
						...item,
						active: item.active ? "active" : "",
						inactive: !item.activated ? "inactive" : "",
					};
					const props = {
						class: `cell ${_props.inactive} ${_props.active}`,
						time: _props.time,
					};
					return div(props, item.text);
				});
			const item = this.match(modes.date, modes.range, modes.calendar).flatMap(
				(child) => {
					const text = {
						year: this.intl.year(child),
						month: this.intl.month(child),
					};
					return div(
						{ class: "item" },
						div({ class: "month" }, text.month),
						div({ class: "week" }, this.weekday),
						div({ class: "body" }, body(child))
					);
				}
			);
			const left = div({ class: "action prev", "data-step": -1 });
			const right = div({ class: "action next", "data-step": 1 });
			const header = this.match(
				() => [left, right],
				() => [left, right],
				() => [
					div(
						{ class: "header" },
						div({ class: "year" }, this.intl.year(this.date)),
						div({ class: "toolbar" }, left, right)
					),
				]
			);
			return div(
				{ class: `tyer ${mode}` },
				div({ class: "container" }, header, item)
			);
		};
		el.innerHTML = buildHTML(mode, modes, this.core);
		$(".cell:not(.inactive)").forEach((node) =>
			node.addEventListener("click", ({ target }) => {
				const time = target.getAttribute("time");
				const value = new Date(+time);
				this.core._setValue(value);
			})
		);
		$(".action").forEach((node) =>
			node.addEventListener("click", (event) => {
				const step = event.target.getAttribute("data-step");
				this.core.setMonth(+step);
			})
		);
	}
}
export default function Tyer(options) {
	const { mode, el, intl, locale, onChange } = options;
	const core = new Core(mode, onChange);
	const { getValue, setDate, setValue, setRange } = core;
	new UI({ mode, intl, locale, core, el });
	Object.defineProperties(this, {
		getValue: { value: getValue.bind(core) },
		setValue: { value: setValue.bind(core) },
		setRange: { value: setRange.bind(core) },
		setDate: { value: setDate.bind(core) },
	});
}
