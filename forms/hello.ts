import { type Asker, Form, markdown } from "formterm";

// A form is a function that takes an asker as an argument
export default new Form({
	id: "helloworld",
	title: "Hello, world!",
	// description supports markdown
	description: markdown`
		A _simple_ form that asks for your name and greets you.
	`
}, async function (asker: Asker) {
	const name = await asker.text({
		title: "What's your name?",
	});
	await asker.info({
		title: `Hello, ${name}!`,
	});
});
