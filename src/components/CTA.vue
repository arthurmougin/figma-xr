<script setup lang="ts">
import { useAuthStore } from '../store/auth.store';
import { Button } from '@/components/ui/button';
const authStore = useAuthStore();
</script>

<template>
    <div class="flex flex-row items-center justify-center flex-wrap">
        <Button id="test" raised @click="authStore.login">Try Figma-xr Now</Button>
        <p class="p-4">or</p>
        <a href="https://www.linkedin.com/in/arthur-mougin/"><Button id="hire" raised>Get in touch</Button></a>
    </div>
</template>

<style scoped></style>
