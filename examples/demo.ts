import { type Asker, Form, markdown } from "formterm";

// A form is a function that takes an asker as an argument
export default new Form({
	id: "demo",
	title: "Demo",
	// description supports markdown
	description: markdown`
		Demo of various form elements using a mock sign-up form.
	`
}, async (a: Asker) => {
	const username = await a.text({
		title: "Username",
	});
	const password = await a.password({
		title: "Password",
	});
	while (true) {
		const confirmPassword = await a.password({
			title: "Confirm Password",
		});
		if (password === confirmPassword) {
			break;
		}
		await a.info({
			title: "Passwords do not match",
			description: "Please try again.",
		});
	}
	const address = await a.group({
		title: "Address",
		questions: {
			line1: a.text({
				title: "Line 1",
			}),
			line2: a.text({
				title: "Line 2",
			}),
			city: a.text({
				title: "City",
			}),
			state: a.dropdown({
				title: "State",
				choices: {
					CA: "California",
					NY: "New York",
				},
			}),
			zip: a.text({
				title: "ZIP Code",
			}),
		},
	});
	await a.confirm({
		title: "Sign up?",
		description: markdown`
			**Username:** ${username}

			**Address:**
			- ${address.line1}
			- ${address.line2}
			- ${address.city}, ${address.state} ${address.zip}
		`,
	})
});
