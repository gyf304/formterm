import { type Asker, Form } from "formterm";

// A form is a function that takes an asker as an argument
export default new Form({
	id: "helloworld",
	name: "Hello, world!",
	// description supports markdown
	description: "This is a simple form that asks for your name and then greets you with a personalized message.",
}, async function (asker: Asker) {
	const name = await asker.text({
		title: "What's your name?",
	});
	await asker.info({
		title: `Hello, ${name}!`,
	});
});
