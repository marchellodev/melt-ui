import { createCalendar, createDateField, createPopover } from '$lib/builders/index.js';
import {
	handleSegmentNavigation,
	isSegmentNavigationKey,
} from '$lib/internal/helpers/date/index.js';
import {
	addMeltEventListener,
	makeElement,
	effect,
	omit,
	toWritableStores,
	parseProps,
	withDefaults as getWithDefaults,
	newOverridable,
} from '$lib/internal/helpers/index.js';
import type { CreateDatePickerProps } from './types.js';

import { pickerOpenFocus } from '$lib/internal/helpers/date/focus.js';
import { createFormatter, dateStore, getDefaultDate } from '$lib/internal/helpers/date/index.js';
import type { MeltActionReturn } from '$lib/internal/types.js';
import type { DatePickerEvents } from './events.js';

const defaults = {
	isDateDisabled: undefined,
	isDateUnavailable: undefined,
	value: undefined,
	positioning: {
		placement: 'bottom',
	},
	closeOnEscape: true,
	closeOnOutsideClick: true,
	onOutsideClick: undefined,
	preventScroll: false,
	forceVisible: false,
	locale: 'en',
	granularity: undefined,
	disabled: false,
	readonly: false,
	minValue: undefined,
	maxValue: undefined,
	weekdayFormat: 'narrow',
} satisfies CreateDatePickerProps;

export function createDatePicker(props?: CreateDatePickerProps) {
	const withDefaults = getWithDefaults(props, defaults);
	const parsed = parseProps(props, defaults);
	const options = omit(parsed, 'value', 'placeholder');

	const dateField = createDateField({
		...withDefaults,
		ids: withDefaults.dateFieldIds,
	});

	const {
		states: { value, placeholder: dfPlaceholder },
	} = dateField;

	;

	const calendar = createCalendar({
		...withDefaults,
		placeholder: dfPlaceholder,
		value: newOverridable(value, {
			get: (v) => v ? [v] : [],
			set: ({ next, commit }) => {
				commit(next[0]);
			},
		}),
		ids: withDefaults.calendarIds,
	});

	const popover = createPopover({
		positioning: withDefaults.positioning,
		arrowSize: withDefaults.arrowSize,
		open: withDefaults.open,
		disableFocusTrap: withDefaults.disableFocusTrap,
		closeOnEscape: withDefaults.closeOnEscape,
		preventScroll: withDefaults.preventScroll,
		closeOnOutsideClick: withDefaults.closeOnOutsideClick,
		portal: withDefaults.portal,
		forceVisible: withDefaults.forceVisible,
		openFocus: pickerOpenFocus,
		ids: withDefaults.popoverIds,
		onOutsideClick: withDefaults.onOutsideClick,
	});

	const trigger = makeElement('popover-trigger', {
		stores: [popover.elements.trigger, options.disabled],
		returned: ([$trigger, $disabled]) => {
			return {
				...omit($trigger, 'action'),
				'aria-label': 'Open date picker',
				'data-segment': 'trigger',
				disabled: $disabled ? true : undefined,
			};
		},
		action: (node: HTMLElement): MeltActionReturn<DatePickerEvents['trigger']> => {
			const unsubKeydown = addMeltEventListener(node, 'keydown', handleTriggerKeydown);

			const { destroy } = popover.elements.trigger(node);

			return {
				destroy() {
					destroy?.();
					unsubKeydown();
				},
			};
		},
	});
	const formatter = createFormatter(options.locale.get());

	effect([options.locale], ([$locale]) => {
		dateField.options.locale.set($locale);
		calendar.options.locale.set($locale);
		if (formatter.getLocale() === $locale) return;
		formatter.setLocale($locale);
	});

	effect([options.weekdayFormat], ([$weekdayFormat]) => {
		calendar.options.weekdayFormat.set($weekdayFormat);
	});

	effect([options.disabled], ([$disabled]) => {
		dateField.options.disabled.set($disabled);
		calendar.options.disabled.set($disabled);
	});

	effect([options.readonly], ([$readonly]) => {
		dateField.options.readonly.set($readonly);
		calendar.options.readonly.set($readonly);
	});

	effect([options.minValue], ([$minValue]) => {
		dateField.options.minValue.set($minValue);
		calendar.options.minValue.set($minValue);
	});

	effect([options.maxValue], ([$maxValue]) => {
		dateField.options.maxValue.set($maxValue);
		calendar.options.maxValue.set($maxValue);
	});

	const dateFieldOptions = omit(
		dateField.options,
		'locale',
		'disabled',
		'readonly',
		'minValue',
		'maxValue'
	);
	const calendarOptions = omit(
		calendar.options,
		'locale',
		'disabled',
		'readonly',
		'minValue',
		'maxValue'
	);

	const {
		states: { open },
	} = popover;

	const defaultDate = getDefaultDate({
		defaultPlaceholder: parsed.placeholder?.get(),
		defaultValue: parsed.value?.get(),
		granularity: parsed.granularity?.get(),
	});

	const placeholder = dateStore(dfPlaceholder, parsed.placeholder?.get() ?? defaultDate);

	effect([open], ([$open]) => {
		if (!$open) {
			const $value = value.get();
			if ($value) {
				placeholder.set($value);
			} else {
				placeholder.reset();
			}
		}
	});

	function handleTriggerKeydown(e: KeyboardEvent) {
		if (isSegmentNavigationKey(e.key)) {
			e.preventDefault();
			handleSegmentNavigation(e, dateField.ids.field.get());
		}
	}

	return {
		elements: {
			...calendar.elements,
			...dateField.elements,
			...popover.elements,
			trigger,
		},
		states: {
			...dateField.states,
			...calendar.states,
			placeholder: placeholder.toWritable(),
			value,
			...popover.states,
		},
		helpers: {
			...calendar.helpers,
		},
		options: {
			...dateFieldOptions,
			...calendarOptions,
			...options,
			...popover.options,
		},
		ids: {
			dateField: dateField.ids,
			calendar: calendar.ids,
			popover: popover.ids,
		},
	};
}
