import { type Asker, Form } from "../lib";

// A form is a function that takes an asker as an argument
export default new Form({
	id: "hello-world",
	name: "Hello, world!",
	description: `# Hello, world!`,
}, async function (asker: Asker) {
	console.log(await asker.date({ title: "What's your birthday?" }));

	const name = await asker.text({ title: "What's your name?" });
	await asker.info({ title: `Hello, ${name}!` });

	const password = await asker.password({ title: "What's your password?" })
	if (password !== "password") {
		await asker.info({ title: "Incorrect password!" });
		return;
	}

	while (true) {
		// You can use regular control flow in a form
		const color = await asker.checkboxes({
			title: "What are your favorite colors?",
			choices: {
				red: "Red",
				blue: "Blue",
				green: "Green",
			},
		});
		if (color.length === 0) {
			await asker.info({ title: "You didn't select any color!" });
			continue;
		}
		await asker.info({ title: `Your favorite ${color.length === 1 ? "color is" : "colors are"} ${color.join(", ")}.` });
		break;
	}

	// You can also use a group of questions
	const group = await asker.group({
		title: "A group of questions",
		questions: {
			a: asker.text({ title: "A?" }),
			b: asker.text({ title: "B?" }),
			c: asker.text({ title: "C?" }),
		}
	});
	console.log(group);
});
