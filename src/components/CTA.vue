<script setup lang="ts">
	import { Button } from "@/components/ui/button";
	import { useAuthStore } from "../store/auth.store";
	const authStore = useAuthStore();
</script>

<template>
	<div class="flex flex-row items-center justify-center flex-wrap">
		<Button
			id="test"
			class="bg-popover text-popover-foreground hover:text-popover"
			raised
			@click="authStore.login"
			>Try Figma-xr Now</Button
		>
		<p class="p-4 text-popover">or</p>
		<a href="https://www.linkedin.com/in/arthur-mougin/">
			<Button
				id="hire"
				class="bg-popover text-popover-foreground hover:text-popover"
				raised
				>Get in touch</Button
			>
		</a>
	</div>
</template>

<style scoped></style>
